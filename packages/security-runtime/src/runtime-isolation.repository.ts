import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { SecurityRuntimePool } from './pool.js'
import { generateId } from './id.js'

export type AtcIsolationType = 'player' | 'server' | 'resource' | 'session' | 'custom'

export type AtcIsolationStatus = 'isolated' | 'quarantined' | 'released'

export interface AtcRuntimeIsolation {
  id: string
  isolationId: string
  entityId: string
  isolationType: AtcIsolationType
  status: AtcIsolationStatus
  ownerServerId: string
  isolationData: Record<string, unknown>
  isolatedAt: Date
  releasedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface IsolateEntityParams {
  entityId: string
  isolationType: AtcIsolationType
  ownerServerId: string
  isolationData?: Record<string, unknown> | undefined
}

interface IsolationRow extends RowDataPacket {
  id: string
  isolation_id: string
  entity_id: string
  isolation_type: AtcIsolationType
  status: AtcIsolationStatus
  owner_server_id: string
  isolation_data: string
  isolated_at: Date
  released_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: IsolationRow): AtcRuntimeIsolation {
  return {
    id: row.id,
    isolationId: row.isolation_id,
    entityId: row.entity_id,
    isolationType: row.isolation_type,
    status: row.status,
    ownerServerId: row.owner_server_id,
    isolationData: typeof row.isolation_data === 'string' ? JSON.parse(row.isolation_data) : row.isolation_data,
    isolatedAt: row.isolated_at,
    releasedAt: row.released_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeIsolationRepository {
  constructor(private pool: SecurityRuntimePool) {}

  async upsert(params: IsolateEntityParams): Promise<AtcRuntimeIsolation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const isolationId = generateId()
      const isolationData = JSON.stringify(params.isolationData ?? {})
      await conn.execute(
        `INSERT INTO atc_runtime_isolation
          (id, isolation_id, entity_id, isolation_type, status, owner_server_id, isolation_data, isolated_at, released_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'isolated', ?, ?, NOW(3), NULL, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           isolation_type = VALUES(isolation_type),
           status = 'isolated',
           owner_server_id = VALUES(owner_server_id),
           isolation_data = VALUES(isolation_data),
           isolated_at = NOW(3),
           released_at = NULL,
           updated_at = NOW(3)`,
        [id, isolationId, params.entityId, params.isolationType, params.ownerServerId, isolationData],
      )
      const [rows] = await conn.execute<IsolationRow[]>(
        `SELECT * FROM atc_runtime_isolation WHERE entity_id = ?`,
        [params.entityId],
      )
      const row = rows[0]
      if (!row) throw new Error(`Isolation record not found after upsert for entity ${params.entityId}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findByEntity(entityId: string): Promise<AtcRuntimeIsolation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<IsolationRow[]>(
        `SELECT * FROM atc_runtime_isolation WHERE entity_id = ?`,
        [entityId],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async release(entityId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        await conn.execute<IsolationRow[]>(
          `SELECT * FROM atc_runtime_isolation WHERE entity_id = ? FOR UPDATE`,
          [entityId],
        )
        await conn.execute(
          `UPDATE atc_runtime_isolation SET status = 'released', released_at = NOW(3), updated_at = NOW(3) WHERE entity_id = ?`,
          [entityId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async cleanupReleased(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const threshold = new Date(Date.now() - thresholdMs)
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_runtime_isolation WHERE status = 'released' AND updated_at < ?`,
        [threshold],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
