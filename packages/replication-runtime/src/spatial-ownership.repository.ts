import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReplicationRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { SpatialOwnershipNotFoundError } from './errors.js'

export type AtcSpatialEntityType = 'npc' | 'vehicle' | 'player' | 'zone' | 'object' | 'custom'

export interface AtcSpatialOwnership {
  id: string
  entityId: string
  entityType: AtcSpatialEntityType
  ownerServerId: string
  regionId: string | null
  lastClaimedAt: Date
  transferredAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ClaimOwnershipParams {
  entityId: string
  entityType: AtcSpatialEntityType
  ownerServerId: string
  regionId?: string | undefined
}

interface SpatialOwnershipRow extends RowDataPacket {
  id: string
  entity_id: string
  entity_type: string
  owner_server_id: string
  region_id: string | null
  last_claimed_at: Date
  transferred_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: SpatialOwnershipRow): AtcSpatialOwnership {
  return {
    id: row.id,
    entityId: row.entity_id,
    entityType: row.entity_type as AtcSpatialEntityType,
    ownerServerId: row.owner_server_id,
    regionId: row.region_id,
    lastClaimedAt: row.last_claimed_at,
    transferredAt: row.transferred_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SpatialOwnershipRepository {
  constructor(private readonly pool: ReplicationRuntimePool) {}

  async findByEntityId(entityId: string): Promise<AtcSpatialOwnership | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SpatialOwnershipRow[]>(
        `SELECT id, entity_id, entity_type, owner_server_id, region_id,
                last_claimed_at, transferred_at, created_at, updated_at
         FROM atc_spatial_ownership
         WHERE entity_id = ?
         LIMIT 1`,
        [entityId]
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async claim(params: ClaimOwnershipParams): Promise<AtcSpatialOwnership> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const regionId = params.regionId ?? null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_spatial_ownership
           (id, entity_id, entity_type, owner_server_id, region_id,
            last_claimed_at, transferred_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(3), NULL, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           owner_server_id = VALUES(owner_server_id),
           region_id = VALUES(region_id),
           last_claimed_at = NOW(3),
           updated_at = NOW(3)`,
        [id, params.entityId, params.entityType, params.ownerServerId, regionId]
      )

      const [rows] = await conn.execute<SpatialOwnershipRow[]>(
        `SELECT id, entity_id, entity_type, owner_server_id, region_id,
                last_claimed_at, transferred_at, created_at, updated_at
         FROM atc_spatial_ownership
         WHERE entity_id = ?
         LIMIT 1`,
        [params.entityId]
      )
      const row = rows[0]
      if (!row) throw new Error(`Spatial ownership not found after claim: ${params.entityId}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async transfer(
    entityId: string,
    fromServerId: string,
    toServerId: string
  ): Promise<AtcSpatialOwnership> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<SpatialOwnershipRow[]>(
          `SELECT id, entity_id, entity_type, owner_server_id, region_id,
                  last_claimed_at, transferred_at, created_at, updated_at
           FROM atc_spatial_ownership
           WHERE entity_id = ?
           FOR UPDATE`,
          [entityId]
        )
        const lockRow = lockRows[0]
        if (!lockRow) {
          throw new SpatialOwnershipNotFoundError(entityId)
        }

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_spatial_ownership
           SET owner_server_id = ?,
               transferred_at = NOW(3),
               updated_at = NOW(3)
           WHERE entity_id = ? AND owner_server_id = ?`,
          [toServerId, entityId, fromServerId]
        )

        const [rows] = await conn.execute<SpatialOwnershipRow[]>(
          `SELECT id, entity_id, entity_type, owner_server_id, region_id,
                  last_claimed_at, transferred_at, created_at, updated_at
           FROM atc_spatial_ownership
           WHERE entity_id = ?
           LIMIT 1`,
          [entityId]
        )
        const row = rows[0]
        if (!row) {
          throw new SpatialOwnershipNotFoundError(entityId)
        }

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

  async listByServerId(serverId: string): Promise<AtcSpatialOwnership[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SpatialOwnershipRow[]>(
        `SELECT id, entity_id, entity_type, owner_server_id, region_id,
                last_claimed_at, transferred_at, created_at, updated_at
         FROM atc_spatial_ownership
         WHERE owner_server_id = ?
         ORDER BY created_at ASC`,
        [serverId]
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async listStale(thresholdMs: number): Promise<AtcSpatialOwnership[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SpatialOwnershipRow[]>(
        `SELECT id, entity_id, entity_type, owner_server_id, region_id,
                last_claimed_at, transferred_at, created_at, updated_at
         FROM atc_spatial_ownership
         WHERE updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)
         ORDER BY updated_at ASC`,
        [thresholdMs]
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async deleteByEntityId(entityId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_spatial_ownership WHERE entity_id = ?`,
        [entityId]
      )
    } finally {
      conn.release()
    }
  }
}
