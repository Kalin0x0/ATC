import type { RowDataPacket } from 'mysql2/promise'
import type { WorldOrchestratorPool } from './pool.js'
import { generateId } from './id.js'
import { WorldRegionNotFoundError } from './errors.js'

export type AtcWorldRegionType = 'city' | 'wilderness' | 'ocean' | 'interior' | 'instance' | 'custom'

export interface AtcWorldRegion {
  id: string
  regionId: string
  regionType: AtcWorldRegionType
  ownerServerId: string | null
  boundsData: Record<string, unknown>
  capacityLimit: number | null
  currentLoad: number
  isActive: boolean
  transferredAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface UpsertWorldRegionParams {
  regionId: string
  regionType: AtcWorldRegionType
  ownerServerId?: string | undefined
  boundsData?: Record<string, unknown> | undefined
  capacityLimit?: number | undefined
}

interface AtcWorldRegionRow extends RowDataPacket {
  id: string
  region_id: string
  region_type: string
  owner_server_id: string | null
  bounds_data: string
  capacity_limit: number | null
  current_load: number
  is_active: number
  transferred_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: AtcWorldRegionRow): AtcWorldRegion {
  return {
    id: row.id,
    regionId: row.region_id,
    regionType: row.region_type as AtcWorldRegionType,
    ownerServerId: row.owner_server_id,
    boundsData: JSON.parse(row.bounds_data) as Record<string, unknown>,
    capacityLimit: row.capacity_limit,
    currentLoad: row.current_load,
    isActive: row.is_active === 1,
    transferredAt: row.transferred_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class WorldRegionRepository {
  constructor(private readonly pool: WorldOrchestratorPool) {}

  async findByRegionId(regionId: string): Promise<AtcWorldRegion | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcWorldRegionRow[]>(
        `SELECT id, region_id, region_type, owner_server_id, bounds_data,
                capacity_limit, current_load, is_active, transferred_at, created_at, updated_at
         FROM atc_world_regions
         WHERE region_id = ?
         LIMIT 1`,
        [regionId],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async upsert(params: UpsertWorldRegionParams): Promise<AtcWorldRegion> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const boundsData = JSON.stringify(params.boundsData ?? {})
      const binds: (string | number | boolean | null)[] = [
        id,
        params.regionId,
        params.regionType,
        params.ownerServerId ?? null,
        boundsData,
        params.capacityLimit ?? null,
      ]

      await conn.execute(
        `INSERT INTO atc_world_regions
           (id, region_id, region_type, owner_server_id, bounds_data, capacity_limit, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           owner_server_id  = VALUES(owner_server_id),
           bounds_data      = VALUES(bounds_data),
           capacity_limit   = VALUES(capacity_limit),
           updated_at       = NOW(3)`,
        binds,
      )

      const result = await this.findByRegionId(params.regionId)
      if (!result) throw new WorldRegionNotFoundError(params.regionId)
      return result
    } finally {
      conn.release()
    }
  }

  async transfer(regionId: string, fromServerId: string, toServerId: string): Promise<AtcWorldRegion> {
    const conn = await this.pool.getConnection()
    await conn.beginTransaction()
    try {
      const [rows] = await conn.execute<AtcWorldRegionRow[]>(
        `SELECT id, region_id, region_type, owner_server_id, bounds_data,
                capacity_limit, current_load, is_active, transferred_at, created_at, updated_at
         FROM atc_world_regions
         WHERE region_id = ?
         LIMIT 1
         FOR UPDATE`,
        [regionId],
      )

      if (!rows[0]) {
        throw new WorldRegionNotFoundError(regionId)
      }

      await conn.execute(
        `UPDATE atc_world_regions
         SET owner_server_id = ?, transferred_at = NOW(3), updated_at = NOW(3)
         WHERE region_id = ? AND owner_server_id = ?`,
        [toServerId, regionId, fromServerId],
      )

      await conn.commit()

      const [updated] = await conn.execute<AtcWorldRegionRow[]>(
        `SELECT id, region_id, region_type, owner_server_id, bounds_data,
                capacity_limit, current_load, is_active, transferred_at, created_at, updated_at
         FROM atc_world_regions
         WHERE region_id = ?
         LIMIT 1`,
        [regionId],
      )

      if (!updated[0]) throw new WorldRegionNotFoundError(regionId)
      return mapRow(updated[0])
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcWorldRegion[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcWorldRegionRow[]>(
        `SELECT id, region_id, region_type, owner_server_id, bounds_data,
                capacity_limit, current_load, is_active, transferred_at, created_at, updated_at
         FROM atc_world_regions
         WHERE is_active = 1
         ORDER BY created_at ASC`,
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async listByServerId(serverId: string): Promise<AtcWorldRegion[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcWorldRegionRow[]>(
        `SELECT id, region_id, region_type, owner_server_id, bounds_data,
                capacity_limit, current_load, is_active, transferred_at, created_at, updated_at
         FROM atc_world_regions
         WHERE owner_server_id = ?
         ORDER BY created_at ASC`,
        [serverId],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async deactivate(regionId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_world_regions
         SET is_active = 0, updated_at = NOW(3)
         WHERE region_id = ?`,
        [regionId],
      )
    } finally {
      conn.release()
    }
  }
}
