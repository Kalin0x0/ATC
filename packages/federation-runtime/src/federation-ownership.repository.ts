import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { FederationRuntimePool } from './pool.js'
import { generateId } from './id.js'

export type AtcOwnershipType = 'exclusive' | 'shared' | 'leased' | 'delegated' | 'custom'
export type AtcOwnershipStatus = 'active' | 'transferred' | 'released'

export interface AtcFederationOwnership {
  id: string
  ownershipId: string
  entityId: string
  ownerClusterId: string
  ownershipType: AtcOwnershipType
  status: AtcOwnershipStatus
  ownerServerId: string
  ownershipData: Record<string, unknown>
  claimedAt: Date
  releasedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ClaimOwnershipParams {
  entityId: string
  ownerClusterId: string
  ownershipType: AtcOwnershipType
  ownerServerId: string
  ownershipData?: Record<string, unknown> | undefined
}

interface FederationOwnershipRow extends RowDataPacket {
  id: string
  ownership_id: string
  entity_id: string
  owner_cluster_id: string
  ownership_type: string
  status: string
  owner_server_id: string
  ownership_data: string | null
  claimed_at: Date
  released_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: FederationOwnershipRow): AtcFederationOwnership {
  let ownershipData: Record<string, unknown> = {}
  if (row.ownership_data) {
    try { ownershipData = JSON.parse(row.ownership_data) as Record<string, unknown> } catch { ownershipData = {} }
  }
  return {
    id: row.id,
    ownershipId: row.ownership_id,
    entityId: row.entity_id,
    ownerClusterId: row.owner_cluster_id,
    ownershipType: row.ownership_type as AtcOwnershipType,
    status: row.status as AtcOwnershipStatus,
    ownerServerId: row.owner_server_id,
    ownershipData,
    claimedAt: row.claimed_at,
    releasedAt: row.released_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class FederationOwnershipRepository {
  constructor(private readonly pool: FederationRuntimePool) {}

  async upsert(params: ClaimOwnershipParams): Promise<AtcFederationOwnership> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const ownershipId = generateId()
      const ownershipDataJson = JSON.stringify(params.ownershipData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_federation_ownership
           (id, ownership_id, entity_id, owner_cluster_id, ownership_type, status, owner_server_id,
            ownership_data, claimed_at, released_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, NOW(3), NULL, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           ownership_id = VALUES(ownership_id),
           owner_cluster_id = VALUES(owner_cluster_id),
           ownership_type = VALUES(ownership_type),
           status = 'active',
           owner_server_id = VALUES(owner_server_id),
           ownership_data = VALUES(ownership_data),
           claimed_at = NOW(3),
           released_at = NULL,
           updated_at = NOW(3)`,
        [id, ownershipId, params.entityId, params.ownerClusterId, params.ownershipType,
         params.ownerServerId, ownershipDataJson] as string[]
      )

      const [rows] = await conn.execute<FederationOwnershipRow[]>(
        `SELECT id, ownership_id, entity_id, owner_cluster_id, ownership_type, status, owner_server_id,
                ownership_data, claimed_at, released_at, created_at, updated_at
         FROM atc_federation_ownership WHERE entity_id = ? LIMIT 1`,
        [params.entityId]
      )
      if (!rows[0]) throw new Error(`Federation ownership not found after upsert: ${params.entityId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByEntity(entityId: string): Promise<AtcFederationOwnership | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FederationOwnershipRow[]>(
        `SELECT id, ownership_id, entity_id, owner_cluster_id, ownership_type, status, owner_server_id,
                ownership_data, claimed_at, released_at, created_at, updated_at
         FROM atc_federation_ownership WHERE entity_id = ? LIMIT 1`,
        [entityId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async transfer(entityId: string, newClusterId: string): Promise<AtcFederationOwnership> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<FederationOwnershipRow[]>(
          `SELECT id, ownership_id, entity_id, owner_cluster_id, ownership_type, status, owner_server_id,
                  ownership_data, claimed_at, released_at, created_at, updated_at
           FROM atc_federation_ownership WHERE entity_id = ? LIMIT 1 FOR UPDATE`,
          [entityId]
        )
        if (!lockRows[0]) throw new Error(`Federation ownership not found for entity: ${entityId}`)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_federation_ownership
           SET owner_cluster_id = ?, status = 'active', updated_at = NOW(3)
           WHERE entity_id = ?`,
          [newClusterId, entityId]
        )

        const [rows] = await conn.execute<FederationOwnershipRow[]>(
          `SELECT id, ownership_id, entity_id, owner_cluster_id, ownership_type, status, owner_server_id,
                  ownership_data, claimed_at, released_at, created_at, updated_at
           FROM atc_federation_ownership WHERE entity_id = ? LIMIT 1`,
          [entityId]
        )
        if (!rows[0]) throw new Error(`Federation ownership not found after transfer: ${entityId}`)
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

  async release(entityId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<FederationOwnershipRow[]>(
          `SELECT id FROM atc_federation_ownership WHERE entity_id = ? LIMIT 1 FOR UPDATE`,
          [entityId]
        )
        if (!lockRows[0]) throw new Error(`Federation ownership not found for entity: ${entityId}`)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_federation_ownership
           SET status = 'released', released_at = NOW(3), updated_at = NOW(3)
           WHERE entity_id = ?`,
          [entityId]
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
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_federation_ownership
         WHERE status = 'released'
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
