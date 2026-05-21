import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeObservabilityPool } from './pool.js'
import { generateId } from './id.js'
import { CorrelationNotFoundError } from './errors.js'

export type AtcFailureType = 'node_crash' | 'timeout' | 'network_partition' | 'resource_exhaustion' | 'cascade' | 'custom'
export type AtcCorrelationStatus = 'open' | 'resolved' | 'suppressed'

export interface AtcFailureCorrelation {
  id: string
  correlationId: string
  failureType: AtcFailureType
  sourceNode: string
  status: AtcCorrelationStatus
  ownerServerId: string
  correlationData: Record<string, unknown>
  correlatedAt: Date
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateCorrelationParams {
  failureType: AtcFailureType
  sourceNode: string
  ownerServerId: string
  correlationData?: Record<string, unknown> | undefined
}

interface CorrelationRow extends RowDataPacket {
  id: string
  correlation_id: string
  failure_type: string
  source_node: string
  status: string
  owner_server_id: string
  correlation_data: string | null
  correlated_at: Date
  resolved_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: CorrelationRow): AtcFailureCorrelation {
  let correlationData: Record<string, unknown> = {}
  if (row.correlation_data) {
    try { correlationData = JSON.parse(row.correlation_data) as Record<string, unknown> } catch { correlationData = {} }
  }
  return {
    id: row.id,
    correlationId: row.correlation_id,
    failureType: row.failure_type as AtcFailureType,
    sourceNode: row.source_node,
    status: row.status as AtcCorrelationStatus,
    ownerServerId: row.owner_server_id,
    correlationData,
    correlatedAt: row.correlated_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class FailureCorrelationRepository {
  constructor(private readonly pool: RuntimeObservabilityPool) {}

  async create(params: CreateCorrelationParams): Promise<AtcFailureCorrelation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const correlationId = generateId()
      const correlationDataJson = JSON.stringify(params.correlationData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_failure_correlation
           (id, correlation_id, failure_type, source_node, status, owner_server_id,
            correlation_data, correlated_at, resolved_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'open', ?, ?, NOW(3), NULL, NOW(3), NOW(3))`,
        [id, correlationId, params.failureType, params.sourceNode,
         params.ownerServerId, correlationDataJson] as string[]
      )

      const [rows] = await conn.execute<CorrelationRow[]>(
        `SELECT id, correlation_id, failure_type, source_node, status, owner_server_id,
                correlation_data, correlated_at, resolved_at, created_at, updated_at
         FROM atc_failure_correlation WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Correlation not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcFailureCorrelation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CorrelationRow[]>(
        `SELECT id, correlation_id, failure_type, source_node, status, owner_server_id,
                correlation_data, correlated_at, resolved_at, created_at, updated_at
         FROM atc_failure_correlation WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async resolve(id: string): Promise<AtcFailureCorrelation> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<CorrelationRow[]>(
          `SELECT id, correlation_id, failure_type, source_node, status, owner_server_id,
                  correlation_data, correlated_at, resolved_at, created_at, updated_at
           FROM atc_failure_correlation WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new CorrelationNotFoundError(id)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_failure_correlation SET status = 'resolved', resolved_at = NOW(3), updated_at = NOW(3) WHERE id = ?`,
          [id]
        )

        const [rows] = await conn.execute<CorrelationRow[]>(
          `SELECT id, correlation_id, failure_type, source_node, status, owner_server_id,
                  correlation_data, correlated_at, resolved_at, created_at, updated_at
           FROM atc_failure_correlation WHERE id = ? LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new CorrelationNotFoundError(id)
        await conn.commit()
        return mapRow(rows[0])
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async listOpen(ownerServerId?: string | undefined): Promise<AtcFailureCorrelation[]> {
    const conn = await this.pool.getConnection()
    try {
      if (ownerServerId !== undefined) {
        const [rows] = await conn.execute<CorrelationRow[]>(
          `SELECT id, correlation_id, failure_type, source_node, status, owner_server_id,
                  correlation_data, correlated_at, resolved_at, created_at, updated_at
           FROM atc_failure_correlation WHERE status = 'open' AND owner_server_id = ? ORDER BY created_at ASC`,
          [ownerServerId]
        )
        return rows.map(mapRow)
      }
      const [rows] = await conn.execute<CorrelationRow[]>(
        `SELECT id, correlation_id, failure_type, source_node, status, owner_server_id,
                correlation_data, correlated_at, resolved_at, created_at, updated_at
         FROM atc_failure_correlation WHERE status = 'open' ORDER BY created_at ASC`
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }
}
