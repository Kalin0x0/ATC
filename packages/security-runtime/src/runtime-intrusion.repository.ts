import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { SecurityRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateIntrusionError, IntrusionNotFoundError } from './errors.js'

export type AtcIntrusionType =
  | 'unauthorized_access'
  | 'rate_limit_breach'
  | 'replay_attack'
  | 'injection'
  | 'tampering'
  | 'custom'

export type AtcIntrusionStatus = 'active' | 'investigating' | 'resolved' | 'false_positive'

export interface AtcRuntimeIntrusion {
  id: string
  intrusionId: string
  intrusionType: AtcIntrusionType
  status: AtcIntrusionStatus
  ownerServerId: string
  entityId: string | null
  sourceNode: string | null
  intrusionNonce: string
  resolvedAt: Date | null
  intrusionData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface CreateIntrusionParams {
  intrusionType: AtcIntrusionType
  ownerServerId: string
  intrusionNonce: string
  entityId?: string | undefined
  sourceNode?: string | undefined
  intrusionData?: Record<string, unknown> | undefined
}

interface IntrusionRow extends RowDataPacket {
  id: string
  intrusion_id: string
  intrusion_type: AtcIntrusionType
  status: AtcIntrusionStatus
  owner_server_id: string
  entity_id: string | null
  source_node: string | null
  intrusion_nonce: string
  resolved_at: Date | null
  intrusion_data: string
  created_at: Date
  updated_at: Date
}

function mapRow(row: IntrusionRow): AtcRuntimeIntrusion {
  return {
    id: row.id,
    intrusionId: row.intrusion_id,
    intrusionType: row.intrusion_type,
    status: row.status,
    ownerServerId: row.owner_server_id,
    entityId: row.entity_id,
    sourceNode: row.source_node,
    intrusionNonce: row.intrusion_nonce,
    resolvedAt: row.resolved_at,
    intrusionData: typeof row.intrusion_data === 'string' ? JSON.parse(row.intrusion_data) : row.intrusion_data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeIntrusionRepository {
  constructor(private pool: SecurityRuntimePool) {}

  async create(params: CreateIntrusionParams): Promise<AtcRuntimeIntrusion> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const intrusionId = generateId()
      const intrusionData = JSON.stringify(params.intrusionData ?? {})
      try {
        await conn.execute(
          `INSERT INTO atc_runtime_intrusions
            (id, intrusion_id, intrusion_type, status, owner_server_id, entity_id, source_node, intrusion_nonce, resolved_at, intrusion_data, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?, ?, ?, NULL, ?, NOW(3), NOW(3))`,
          [id, intrusionId, params.intrusionType, params.ownerServerId, params.entityId ?? null, params.sourceNode ?? null, params.intrusionNonce, intrusionData],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateIntrusionError(params.intrusionNonce)
        }
        throw err
      }
      const [rows] = await conn.execute<IntrusionRow[]>(
        `SELECT * FROM atc_runtime_intrusions WHERE id = ?`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new IntrusionNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeIntrusion | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<IntrusionRow[]>(
        `SELECT * FROM atc_runtime_intrusions WHERE id = ?`,
        [id],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcIntrusionStatus, resolvedAt?: Date): Promise<AtcRuntimeIntrusion> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [locked] = await conn.execute<IntrusionRow[]>(
          `SELECT * FROM atc_runtime_intrusions WHERE id = ? FOR UPDATE`,
          [id],
        )
        if (!locked[0]) {
          throw new IntrusionNotFoundError(id)
        }
        await conn.execute(
          `UPDATE atc_runtime_intrusions SET status = ?, resolved_at = ?, updated_at = NOW(3) WHERE id = ?`,
          [status, resolvedAt ?? null, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [rows] = await conn.execute<IntrusionRow[]>(
        `SELECT * FROM atc_runtime_intrusions WHERE id = ?`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new IntrusionNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async listActive(ownerServerId?: string): Promise<AtcRuntimeIntrusion[]> {
    const conn = await this.pool.getConnection()
    try {
      let rows: IntrusionRow[]
      if (ownerServerId !== undefined) {
        const [result] = await conn.execute<IntrusionRow[]>(
          `SELECT * FROM atc_runtime_intrusions WHERE status = 'active' AND owner_server_id = ? ORDER BY created_at DESC`,
          [ownerServerId],
        )
        rows = result
      } else {
        const [result] = await conn.execute<IntrusionRow[]>(
          `SELECT * FROM atc_runtime_intrusions WHERE status = 'active' ORDER BY created_at DESC`,
        )
        rows = result
      }
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const threshold = new Date(Date.now() - thresholdMs)
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_runtime_intrusions WHERE status IN ('resolved', 'false_positive') AND updated_at < ?`,
        [threshold],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
