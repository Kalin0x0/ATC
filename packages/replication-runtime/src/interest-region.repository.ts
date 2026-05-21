import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReplicationRuntimePool } from './pool.js'
import { generateId } from './id.js'

export type AtcInterestRegionType = 'zone' | 'cell' | 'sector' | 'custom'

export interface AtcInterestRegion {
  id: string
  regionId: string
  regionType: AtcInterestRegionType
  ownerServerId: string | null
  boundsData: Record<string, unknown>
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UpsertInterestRegionParams {
  regionId: string
  regionType: AtcInterestRegionType
  ownerServerId?: string | undefined
  boundsData?: Record<string, unknown> | undefined
}

interface InterestRegionRow extends RowDataPacket {
  id: string
  region_id: string
  region_type: string
  owner_server_id: string | null
  bounds_data: string | null
  is_active: number
  created_at: Date
  updated_at: Date
}

function mapRow(row: InterestRegionRow): AtcInterestRegion {
  let boundsData: Record<string, unknown> = {}
  if (row.bounds_data) {
    try {
      boundsData = JSON.parse(row.bounds_data) as Record<string, unknown>
    } catch {
      boundsData = {}
    }
  }
  return {
    id: row.id,
    regionId: row.region_id,
    regionType: row.region_type as AtcInterestRegionType,
    ownerServerId: row.owner_server_id,
    boundsData,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class InterestRegionRepository {
  constructor(private readonly pool: ReplicationRuntimePool) {}

  async findByRegionId(regionId: string): Promise<AtcInterestRegion | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InterestRegionRow[]>(
        `SELECT id, region_id, region_type, owner_server_id, bounds_data, is_active, created_at, updated_at
         FROM atc_interest_regions
         WHERE region_id = ?
         LIMIT 1`,
        [regionId]
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async upsert(params: UpsertInterestRegionParams): Promise<AtcInterestRegion> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const boundsDataJson = JSON.stringify(params.boundsData ?? {})
      const ownerServerId = params.ownerServerId ?? null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_interest_regions
           (id, region_id, region_type, owner_server_id, bounds_data, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           region_type = VALUES(region_type),
           owner_server_id = VALUES(owner_server_id),
           bounds_data = VALUES(bounds_data),
           is_active = 1,
           updated_at = NOW(3)`,
        [id, params.regionId, params.regionType, ownerServerId, boundsDataJson]
      )

      const [rows] = await conn.execute<InterestRegionRow[]>(
        `SELECT id, region_id, region_type, owner_server_id, bounds_data, is_active, created_at, updated_at
         FROM atc_interest_regions
         WHERE region_id = ?
         LIMIT 1`,
        [params.regionId]
      )
      const row = rows[0]
      if (!row) throw new Error(`Interest region not found after upsert: ${params.regionId}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcInterestRegion[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InterestRegionRow[]>(
        `SELECT id, region_id, region_type, owner_server_id, bounds_data, is_active, created_at, updated_at
         FROM atc_interest_regions
         WHERE is_active = 1
         ORDER BY created_at ASC`
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async deactivate(regionId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<ResultSetHeader>(
        `UPDATE atc_interest_regions
         SET is_active = 0, updated_at = NOW(3)
         WHERE region_id = ?`,
        [regionId]
      )
    } finally {
      conn.release()
    }
  }
}
