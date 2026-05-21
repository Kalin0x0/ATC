import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { MetaRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { MetaNotFoundError, DuplicateMetaError } from './errors.js'

export type AtcMetaType = 'orchestrator' | 'scheduler' | 'balancer' | 'watchdog' | 'coordinator' | 'custom'
export type AtcMetaStatus = 'active' | 'paused' | 'terminated' | 'degraded'

export interface AtcMetaRuntime {
  id: string
  metaId: string
  metaType: AtcMetaType
  status: AtcMetaStatus
  ownerServerId: string
  metaNonce: string
  metaData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface CreateMetaRuntimeParams {
  metaType: AtcMetaType
  ownerServerId: string
  metaNonce: string
  metaData?: Record<string, unknown> | undefined
}

interface MetaRuntimeRow extends RowDataPacket {
  id: string
  meta_id: string
  meta_type: string
  status: string
  owner_server_id: string
  meta_nonce: string
  meta_data: string | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: MetaRuntimeRow): AtcMetaRuntime {
  let metaData: Record<string, unknown> = {}
  if (row.meta_data) {
    try { metaData = JSON.parse(row.meta_data) as Record<string, unknown> } catch { metaData = {} }
  }
  return {
    id: row.id,
    metaId: row.meta_id,
    metaType: row.meta_type as AtcMetaType,
    status: row.status as AtcMetaStatus,
    ownerServerId: row.owner_server_id,
    metaNonce: row.meta_nonce,
    metaData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class MetaRuntimeRepository {
  constructor(private readonly pool: MetaRuntimePool) {}

  async create(params: CreateMetaRuntimeParams): Promise<AtcMetaRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const metaId = generateId()
      const metaDataJson = JSON.stringify(params.metaData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_meta_runtime
             (id, meta_id, meta_type, status, owner_server_id, meta_nonce, meta_data, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?, ?, NOW(3), NOW(3))`,
          [id, metaId, params.metaType, params.ownerServerId, params.metaNonce, metaDataJson] as string[],
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateMetaError(params.metaNonce)
        throw err
      }

      const [rows] = await conn.execute<MetaRuntimeRow[]>(
        `SELECT id, meta_id, meta_type, status, owner_server_id, meta_nonce, meta_data, created_at, updated_at
         FROM atc_meta_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new MetaNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcMetaRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MetaRuntimeRow[]>(
        `SELECT id, meta_id, meta_type, status, owner_server_id, meta_nonce, meta_data, created_at, updated_at
         FROM atc_meta_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcMetaStatus): Promise<AtcMetaRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<MetaRuntimeRow[]>(
          `SELECT id FROM atc_meta_runtime WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        const lockRow = lockRows[0]
        if (!lockRow) throw new MetaNotFoundError(id)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_meta_runtime SET status = ?, updated_at = NOW(3) WHERE id = ?`,
          [status, id],
        )

        const [rows] = await conn.execute<MetaRuntimeRow[]>(
          `SELECT id, meta_id, meta_type, status, owner_server_id, meta_nonce, meta_data, created_at, updated_at
           FROM atc_meta_runtime WHERE id = ? LIMIT 1`,
          [id],
        )
        const row = rows[0]
        if (!row) throw new MetaNotFoundError(id)
        await conn.commit()
        return mapRow(row)
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async listActive(ownerServerId?: string | undefined): Promise<AtcMetaRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      if (ownerServerId !== undefined) {
        const [rows] = await conn.execute<MetaRuntimeRow[]>(
          `SELECT id, meta_id, meta_type, status, owner_server_id, meta_nonce, meta_data, created_at, updated_at
           FROM atc_meta_runtime WHERE status = 'active' AND owner_server_id = ? ORDER BY created_at ASC`,
          [ownerServerId],
        )
        return rows.map(mapRow)
      }
      const [rows] = await conn.execute<MetaRuntimeRow[]>(
        `SELECT id, meta_id, meta_type, status, owner_server_id, meta_nonce, meta_data, created_at, updated_at
         FROM atc_meta_runtime WHERE status = 'active' ORDER BY created_at ASC`,
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
        `DELETE FROM atc_meta_runtime
         WHERE status IN ('terminated', 'degraded')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
