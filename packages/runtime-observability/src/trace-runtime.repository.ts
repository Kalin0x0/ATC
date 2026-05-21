import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeObservabilityPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateTraceError, TraceNotFoundError } from './errors.js'

export type AtcTraceType = 'request' | 'event' | 'query' | 'job' | 'rpc' | 'custom'
export type AtcTraceStatus = 'active' | 'completed' | 'failed' | 'timed_out'

export interface AtcRuntimeTrace {
  id: string
  traceId: string
  traceType: AtcTraceType
  status: AtcTraceStatus
  sourceNode: string
  targetNode: string | null
  ownerServerId: string
  traceNonce: string
  traceData: Record<string, unknown>
  startedAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateTraceParams {
  traceType: AtcTraceType
  sourceNode: string
  ownerServerId: string
  traceNonce: string
  targetNode?: string | undefined
  traceData?: Record<string, unknown> | undefined
}

interface TraceRow extends RowDataPacket {
  id: string
  trace_id: string
  trace_type: string
  status: string
  source_node: string
  target_node: string | null
  owner_server_id: string
  trace_nonce: string
  trace_data: string | null
  started_at: Date
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: TraceRow): AtcRuntimeTrace {
  let traceData: Record<string, unknown> = {}
  if (row.trace_data) {
    try { traceData = JSON.parse(row.trace_data) as Record<string, unknown> } catch { traceData = {} }
  }
  return {
    id: row.id,
    traceId: row.trace_id,
    traceType: row.trace_type as AtcTraceType,
    status: row.status as AtcTraceStatus,
    sourceNode: row.source_node,
    targetNode: row.target_node,
    ownerServerId: row.owner_server_id,
    traceNonce: row.trace_nonce,
    traceData,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class TraceRuntimeRepository {
  constructor(private readonly pool: RuntimeObservabilityPool) {}

  async create(params: CreateTraceParams): Promise<AtcRuntimeTrace> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const traceId = generateId()
      const traceDataJson = JSON.stringify(params.traceData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_traces
             (id, trace_id, trace_type, status, source_node, target_node,
              owner_server_id, trace_nonce, trace_data, started_at, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, NOW(3), NULL, NOW(3), NOW(3))`,
          [id, traceId, params.traceType, params.sourceNode, params.targetNode ?? null,
           params.ownerServerId, params.traceNonce, traceDataJson] as (string | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateTraceError(params.traceNonce)
        throw err
      }

      const [rows] = await conn.execute<TraceRow[]>(
        `SELECT id, trace_id, trace_type, status, source_node, target_node,
                owner_server_id, trace_nonce, trace_data, started_at, completed_at, created_at, updated_at
         FROM atc_runtime_traces WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Trace not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeTrace | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TraceRow[]>(
        `SELECT id, trace_id, trace_type, status, source_node, target_node,
                owner_server_id, trace_nonce, trace_data, started_at, completed_at, created_at, updated_at
         FROM atc_runtime_traces WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcTraceStatus, completedAt?: Date | undefined): Promise<AtcRuntimeTrace> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<TraceRow[]>(
          `SELECT id, trace_id, trace_type, status, source_node, target_node,
                  owner_server_id, trace_nonce, trace_data, started_at, completed_at, created_at, updated_at
           FROM atc_runtime_traces WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new TraceNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_traces SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as string[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_traces SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id]
          )
        }

        const [rows] = await conn.execute<TraceRow[]>(
          `SELECT id, trace_id, trace_type, status, source_node, target_node,
                  owner_server_id, trace_nonce, trace_data, started_at, completed_at, created_at, updated_at
           FROM atc_runtime_traces WHERE id = ? LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new TraceNotFoundError(id)
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

  async listActive(ownerServerId?: string | undefined): Promise<AtcRuntimeTrace[]> {
    const conn = await this.pool.getConnection()
    try {
      if (ownerServerId !== undefined) {
        const [rows] = await conn.execute<TraceRow[]>(
          `SELECT id, trace_id, trace_type, status, source_node, target_node,
                  owner_server_id, trace_nonce, trace_data, started_at, completed_at, created_at, updated_at
           FROM atc_runtime_traces
           WHERE status = 'active' AND owner_server_id = ?
           ORDER BY created_at ASC`,
          [ownerServerId]
        )
        return rows.map(mapRow)
      }
      const [rows] = await conn.execute<TraceRow[]>(
        `SELECT id, trace_id, trace_type, status, source_node, target_node,
                owner_server_id, trace_nonce, trace_data, started_at, completed_at, created_at, updated_at
         FROM atc_runtime_traces WHERE status = 'active' ORDER BY created_at ASC`
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_runtime_traces
         WHERE status IN ('completed', 'failed', 'timed_out')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
