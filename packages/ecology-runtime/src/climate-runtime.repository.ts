import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EcologyRuntimePool } from './pool.js'
import { generateId } from './id.js'

export type AtcClimateType =
  | 'tropical'
  | 'temperate'
  | 'arctic'
  | 'arid'
  | 'continental'
  | 'custom'

export type AtcClimateStatus = 'stable' | 'changing' | 'extreme' | 'recovering'

export interface AtcClimateRuntime {
  id: string
  regionId: string
  climateType: AtcClimateType
  status: AtcClimateStatus
  ownerServerId: string
  temperature: number
  humidity: number
  climateData: Record<string, unknown>
  measuredAt: Date
  createdAt: Date
  updatedAt: Date
}

interface ClimateRuntimeRow extends RowDataPacket {
  id: string
  region_id: string
  climate_type: string
  status: string
  owner_server_id: string
  temperature: string
  humidity: string
  climate_data: string
  measured_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: ClimateRuntimeRow): AtcClimateRuntime {
  let climateData: Record<string, unknown> = {}
  try {
    const parsed: unknown = typeof row.climate_data === 'string'
      ? JSON.parse(row.climate_data)
      : row.climate_data
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      climateData = parsed as Record<string, unknown>
    }
  } catch {
    climateData = {}
  }
  return {
    id: row.id,
    regionId: row.region_id,
    climateType: row.climate_type as AtcClimateType,
    status: row.status as AtcClimateStatus,
    ownerServerId: row.owner_server_id,
    temperature: Number(row.temperature),
    humidity: Number(row.humidity),
    climateData,
    measuredAt: row.measured_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertClimateParams {
  regionId: string
  climateType: AtcClimateType
  status: AtcClimateStatus
  ownerServerId: string
  temperature: number
  humidity: number
  climateData?: Record<string, unknown>
}

export class ClimateRuntimeRepository {
  constructor(private readonly pool: EcologyRuntimePool) {}

  async upsert(params: UpsertClimateParams): Promise<AtcClimateRuntime> {
    const id = generateId()
    const climateData = JSON.stringify(params.climateData ?? {})
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_climate_runtime
           (id, region_id, climate_type, status, owner_server_id,
            temperature, humidity, climate_data, measured_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           climate_type    = VALUES(climate_type),
           status          = VALUES(status),
           owner_server_id = VALUES(owner_server_id),
           temperature     = VALUES(temperature),
           humidity        = VALUES(humidity),
           climate_data    = VALUES(climate_data),
           measured_at     = NOW(3),
           updated_at      = NOW(3)`,
        [
          id,
          params.regionId,
          params.climateType,
          params.status,
          params.ownerServerId,
          params.temperature,
          params.humidity,
          climateData,
        ],
      )
      const [rows] = await conn.execute<ClimateRuntimeRow[]>(
        `SELECT * FROM atc_climate_runtime WHERE region_id = ? LIMIT 1`,
        [params.regionId],
      )
      const row = rows[0]
      if (!row) throw new Error(`Climate runtime not found after upsert for region: ${params.regionId}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findByRegion(regionId: string): Promise<AtcClimateRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ClimateRuntimeRow[]>(
        `SELECT * FROM atc_climate_runtime WHERE region_id = ? LIMIT 1`,
        [regionId],
      )
      const row = rows[0]
      return row ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_climate_runtime
         WHERE status = 'extreme'
           AND measured_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
