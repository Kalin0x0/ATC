import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeObservabilityPool } from './pool.js'
import { generateId } from './id.js'

export type AtcTraceLevel = 'debug' | 'info' | 'warn' | 'error'

export interface AtcTraceRuntimeState {
  id: string
  entityId: string
  traceLevel: AtcTraceLevel
  isActive: boolean
  ownerServerId: string
  expiresAt: Date | null
  traceData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface UpsertTraceStateParams {
  entityId: string
  traceLevel: AtcTraceLevel
  ownerServerId: string
  expiresAt?: Date | null | undefined
  traceData?: Record<string, unknown> | undefined
}

interface TraceStateRow extends RowDataPacket {
  id: string
  entity_id: string
  trace_level: string
  is_active: number
  owner_server_id: string
  expires_at: Date | null
  trace_data: string | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: TraceStateRow): AtcTraceRuntimeState {
  let traceData: Record<string, unknown> = {}
  if (row.trace_data) {
    try { traceData = JSON.parse(row.trace_data) as Record<string, unknown> } catch { traceData = {} }
  }
  return {
    id: row.id,
    entityId: row.entity_id,
    traceLevel: row.trace_level as AtcTraceLevel,
    isActive: row.is_active === 1,
    ownerServerId: row.owner_server_id,
    expiresAt: row.expires_at,
    traceData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class TraceRuntimeStateRepository {
  constructor(private readonly pool: RuntimeObservabilityPool) {}

  async upsert(params: UpsertTraceStateParams): Promise<AtcTraceRuntimeState> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const traceDataJson = JSON.stringify(params.traceData ?? {})
      const expiresAt = params.expiresAt != null
        ? params.expiresAt.toISOString().replace('T', ' ').replace('Z', '')
        : null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_trace_runtime
           (id, entity_id, trace_level, is_active, owner_server_id, expires_at, trace_data, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           trace_level = VALUES(trace_level),
           is_active = 1,
           owner_server_id = VALUES(owner_server_id),
           expires_at = VALUES(expires_at),
           trace_data = VALUES(trace_data),
           updated_at = NOW(3)`,
        [id, params.entityId, params.traceLevel, params.ownerServerId,
         expiresAt, traceDataJson] as (string | null)[]
      )

      const [rows] = await conn.execute<TraceStateRow[]>(
        `SELECT id, entity_id, trace_level, is_active, owner_server_id, expires_at, trace_data, created_at, updated_at
         FROM atc_trace_runtime WHERE entity_id = ? LIMIT 1`,
        [params.entityId]
      )
      if (!rows[0]) throw new Error(`Trace state not found after upsert: ${params.entityId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByEntity(entityId: string): Promise<AtcTraceRuntimeState | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TraceStateRow[]>(
        `SELECT id, entity_id, trace_level, is_active, owner_server_id, expires_at, trace_data, created_at, updated_at
         FROM atc_trace_runtime WHERE entity_id = ? LIMIT 1`,
        [entityId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async deactivate(entityId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<ResultSetHeader>(
        `UPDATE atc_trace_runtime SET is_active = 0, updated_at = NOW(3) WHERE entity_id = ?`,
        [entityId]
      )
    } finally {
      conn.release()
    }
  }

  async cleanupExpired(): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_trace_runtime WHERE expires_at IS NOT NULL AND expires_at < NOW(3)`
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
