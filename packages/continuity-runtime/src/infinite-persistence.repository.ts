import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ContinuityRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { PersistenceNodeNotFoundError } from './errors.js'

export type AtcPersistenceNodeType = 'primary' | 'replica' | 'archive' | 'cache' | 'custom'
export type AtcPersistenceNodeStatus = 'active' | 'syncing' | 'stale' | 'failed'

export interface AtcInfinitePersistence {
  id: string
  nodeId: string
  nodeType: AtcPersistenceNodeType
  status: AtcPersistenceNodeStatus
  ownerServerId: string
  persistenceData: Record<string, unknown>
  syncedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertPersistenceNodeParams {
  nodeId: string
  nodeType: AtcPersistenceNodeType
  ownerServerId: string
  persistenceData?: Record<string, unknown> | undefined
}

interface InfinitePersistenceRow extends RowDataPacket {
  id: string
  node_id: string
  node_type: string
  status: string
  owner_server_id: string
  persistence_data: string | null
  synced_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: InfinitePersistenceRow): AtcInfinitePersistence {
  let persistenceData: Record<string, unknown> = {}
  if (row.persistence_data) {
    try {
      persistenceData = JSON.parse(row.persistence_data) as Record<string, unknown>
    } catch {
      persistenceData = {}
    }
  }
  return {
    id: row.id,
    nodeId: row.node_id,
    nodeType: row.node_type as AtcPersistenceNodeType,
    status: row.status as AtcPersistenceNodeStatus,
    ownerServerId: row.owner_server_id,
    persistenceData,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class InfinitePersistenceRepository {
  constructor(private readonly pool: ContinuityRuntimePool) {}

  async upsert(params: UpsertPersistenceNodeParams): Promise<AtcInfinitePersistence> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const persistenceDataJson = JSON.stringify(params.persistenceData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_infinite_persistence
           (id, node_id, node_type, status, owner_server_id,
            persistence_data, synced_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           node_type = VALUES(node_type),
           status = 'active',
           owner_server_id = VALUES(owner_server_id),
           persistence_data = VALUES(persistence_data),
           synced_at = NOW(3),
           updated_at = NOW(3)`,
        [
          id,
          params.nodeId,
          params.nodeType,
          params.ownerServerId,
          persistenceDataJson,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<InfinitePersistenceRow[]>(
        `SELECT id, node_id, node_type, status, owner_server_id,
                persistence_data, synced_at, created_at, updated_at
         FROM atc_infinite_persistence
         WHERE node_id = ?
         LIMIT 1`,
        [params.nodeId]
      )
      if (!rows[0]) throw new Error(`Infinite persistence node not found after upsert: ${params.nodeId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByNodeId(nodeId: string): Promise<AtcInfinitePersistence | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InfinitePersistenceRow[]>(
        `SELECT id, node_id, node_type, status, owner_server_id,
                persistence_data, synced_at, created_at, updated_at
         FROM atc_infinite_persistence
         WHERE node_id = ?
         LIMIT 1`,
        [nodeId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async failNode(nodeId: string): Promise<AtcInfinitePersistence> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<InfinitePersistenceRow[]>(
          `SELECT id, node_id, node_type, status, owner_server_id,
                  persistence_data, synced_at, created_at, updated_at
           FROM atc_infinite_persistence
           WHERE node_id = ?
           LIMIT 1
           FOR UPDATE`,
          [nodeId]
        )
        if (!lockRows[0]) throw new PersistenceNodeNotFoundError(nodeId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_infinite_persistence
           SET status = 'failed', updated_at = NOW(3)
           WHERE node_id = ?`,
          [nodeId] as (string | number | boolean | null)[]
        )

        const [rows] = await conn.execute<InfinitePersistenceRow[]>(
          `SELECT id, node_id, node_type, status, owner_server_id,
                  persistence_data, synced_at, created_at, updated_at
           FROM atc_infinite_persistence
           WHERE node_id = ?
           LIMIT 1`,
          [nodeId]
        )
        if (!rows[0]) throw new PersistenceNodeNotFoundError(nodeId)

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

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_infinite_persistence
         WHERE status IN ('failed', 'stale')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
