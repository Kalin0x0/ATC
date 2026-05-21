import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { FederationRuntimePool } from './pool.js'
import { generateId } from './id.js'

export type AtcRegionType = 'primary' | 'secondary' | 'edge' | 'backup' | 'custom'
export type AtcRegionStatus = 'active' | 'syncing' | 'stale' | 'offline'

export interface AtcRegionRuntime {
  id: string
  regionId: string
  regionType: AtcRegionType
  status: AtcRegionStatus
  ownerServerId: string
  syncNonce: string | null
  isActive: boolean
  regionData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface UpsertRegionParams {
  regionId: string
  regionType: AtcRegionType
  ownerServerId: string
  syncNonce?: string | undefined
  regionData?: Record<string, unknown> | undefined
}

interface RegionRuntimeRow extends RowDataPacket {
  id: string
  region_id: string
  region_type: string
  status: string
  owner_server_id: string
  sync_nonce: string | null
  is_active: number
  region_data: string | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RegionRuntimeRow): AtcRegionRuntime {
  let regionData: Record<string, unknown> = {}
  if (row.region_data) {
    try { regionData = JSON.parse(row.region_data) as Record<string, unknown> } catch { regionData = {} }
  }
  return {
    id: row.id,
    regionId: row.region_id,
    regionType: row.region_type as AtcRegionType,
    status: row.status as AtcRegionStatus,
    ownerServerId: row.owner_server_id,
    syncNonce: row.sync_nonce,
    isActive: row.is_active === 1,
    regionData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RegionRuntimeRepository {
  constructor(private readonly pool: FederationRuntimePool) {}

  async upsert(params: UpsertRegionParams): Promise<AtcRegionRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const regionDataJson = JSON.stringify(params.regionData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_region_runtime
           (id, region_id, region_type, status, owner_server_id, sync_nonce, is_active,
            region_data, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, 1, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           region_type = VALUES(region_type),
           status = 'active',
           owner_server_id = VALUES(owner_server_id),
           sync_nonce = VALUES(sync_nonce),
           is_active = 1,
           region_data = VALUES(region_data),
           updated_at = NOW(3)`,
        [id, params.regionId, params.regionType, params.ownerServerId,
         params.syncNonce ?? null, regionDataJson] as (string | null)[]
      )

      const [rows] = await conn.execute<RegionRuntimeRow[]>(
        `SELECT id, region_id, region_type, status, owner_server_id, sync_nonce, is_active,
                region_data, created_at, updated_at
         FROM atc_region_runtime WHERE region_id = ? LIMIT 1`,
        [params.regionId]
      )
      if (!rows[0]) throw new Error(`Region runtime not found after upsert: ${params.regionId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByRegion(regionId: string): Promise<AtcRegionRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RegionRuntimeRow[]>(
        `SELECT id, region_id, region_type, status, owner_server_id, sync_nonce, is_active,
                region_data, created_at, updated_at
         FROM atc_region_runtime WHERE region_id = ? LIMIT 1`,
        [regionId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async deactivate(regionId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<ResultSetHeader>(
        `UPDATE atc_region_runtime SET is_active = 0, updated_at = NOW(3) WHERE region_id = ?`,
        [regionId]
      )
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_region_runtime
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
