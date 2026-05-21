import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { PersistenceRuntimePool } from './pool.js'
import { generateId } from './id.js'

export type AtcPersistenceType = 'entity' | 'world' | 'session' | 'cache' | 'custom'
export type AtcPersistenceStatus = 'active' | 'syncing' | 'stale' | 'error'

export interface AtcPersistenceRuntime {
  id: string
  entityId: string
  persistenceType: AtcPersistenceType
  status: AtcPersistenceStatus
  isActive: boolean
  ownerServerId: string
  persistenceData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface UpsertPersistenceParams {
  entityId: string
  persistenceType: AtcPersistenceType
  ownerServerId: string
  status?: AtcPersistenceStatus | undefined
  persistenceData?: Record<string, unknown> | undefined
}

interface PersistenceRow extends RowDataPacket {
  id: string
  entity_id: string
  persistence_type: string
  status: string
  is_active: number
  owner_server_id: string
  persistence_data: string | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: PersistenceRow): AtcPersistenceRuntime {
  let persistenceData: Record<string, unknown> = {}
  if (row.persistence_data) {
    try { persistenceData = JSON.parse(row.persistence_data) as Record<string, unknown> } catch { persistenceData = {} }
  }
  return {
    id: row.id,
    entityId: row.entity_id,
    persistenceType: row.persistence_type as AtcPersistenceType,
    status: row.status as AtcPersistenceStatus,
    isActive: row.is_active === 1,
    ownerServerId: row.owner_server_id,
    persistenceData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class PersistenceRuntimeRepository {
  constructor(private readonly pool: PersistenceRuntimePool) {}

  async upsert(params: UpsertPersistenceParams): Promise<AtcPersistenceRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const status = params.status ?? 'active'
      const persistenceDataJson = JSON.stringify(params.persistenceData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_persistence_runtime
           (id, entity_id, persistence_type, status, is_active, owner_server_id, persistence_data, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           persistence_type = VALUES(persistence_type),
           status = VALUES(status),
           is_active = 1,
           owner_server_id = VALUES(owner_server_id),
           persistence_data = VALUES(persistence_data),
           updated_at = NOW(3)`,
        [id, params.entityId, params.persistenceType, status,
         params.ownerServerId, persistenceDataJson] as string[]
      )

      const [rows] = await conn.execute<PersistenceRow[]>(
        `SELECT id, entity_id, persistence_type, status, is_active, owner_server_id, persistence_data, created_at, updated_at
         FROM atc_persistence_runtime WHERE entity_id = ? LIMIT 1`,
        [params.entityId]
      )
      if (!rows[0]) throw new Error(`Persistence state not found after upsert: ${params.entityId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByEntity(entityId: string): Promise<AtcPersistenceRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PersistenceRow[]>(
        `SELECT id, entity_id, persistence_type, status, is_active, owner_server_id, persistence_data, created_at, updated_at
         FROM atc_persistence_runtime WHERE entity_id = ? LIMIT 1`,
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
        `UPDATE atc_persistence_runtime SET is_active = 0, updated_at = NOW(3) WHERE entity_id = ?`,
        [entityId]
      )
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_persistence_runtime
         WHERE is_active = 0
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
