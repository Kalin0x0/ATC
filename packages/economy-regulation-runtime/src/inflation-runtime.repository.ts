import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EconomyRegulationPool } from './pool.js'
import { generateId } from './id.js'

export type AtcInflationStatus = 'stable' | 'inflationary' | 'deflationary' | 'hyperinflationary'

export interface AtcInflationRuntime {
  id: string
  regionId: string
  inflationRate: number
  status: AtcInflationStatus
  ownerServerId: string
  inflationData: Record<string, unknown>
  isActive: boolean
  measuredAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertInflationParams {
  regionId: string
  inflationRate: number
  status: AtcInflationStatus
  ownerServerId: string
  inflationData?: Record<string, unknown> | undefined
}

interface InflationRuntimeRow extends RowDataPacket {
  id: string
  region_id: string
  inflation_rate: string
  status: AtcInflationStatus
  owner_server_id: string
  inflation_data: string
  is_active: number | boolean
  measured_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: InflationRuntimeRow): AtcInflationRuntime {
  return {
    id: row.id,
    regionId: row.region_id,
    inflationRate: parseFloat(row.inflation_rate),
    status: row.status,
    ownerServerId: row.owner_server_id,
    inflationData: typeof row.inflation_data === 'string'
      ? (JSON.parse(row.inflation_data) as Record<string, unknown>)
      : (row.inflation_data as unknown as Record<string, unknown>),
    isActive: Boolean(row.is_active),
    measuredAt: row.measured_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class InflationRuntimeRepository {
  constructor(private pool: EconomyRegulationPool) {}

  async upsert(params: UpsertInflationParams): Promise<AtcInflationRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const inflationData = JSON.stringify(params.inflationData ?? {})
      await conn.execute(
        `INSERT INTO atc_inflation_runtime
          (id, region_id, inflation_rate, status, owner_server_id, inflation_data, is_active, measured_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, true, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           inflation_rate = VALUES(inflation_rate),
           status = VALUES(status),
           owner_server_id = VALUES(owner_server_id),
           inflation_data = VALUES(inflation_data),
           is_active = true,
           measured_at = NOW(3),
           updated_at = NOW(3)`,
        [id, params.regionId, params.inflationRate, params.status, params.ownerServerId, inflationData],
      )
      const [rows] = await conn.execute<InflationRuntimeRow[]>(
        'SELECT * FROM atc_inflation_runtime WHERE region_id = ?',
        [params.regionId],
      )
      return mapRow(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findByRegion(regionId: string): Promise<AtcInflationRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InflationRuntimeRow[]>(
        'SELECT * FROM atc_inflation_runtime WHERE region_id = ?',
        [regionId],
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
        'UPDATE atc_inflation_runtime SET is_active = false, updated_at = NOW(3) WHERE region_id = ?',
        [regionId],
      )
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const threshold = new Date(Date.now() - thresholdMs)
      const [result] = await conn.execute<ResultSetHeader>(
        'DELETE FROM atc_inflation_runtime WHERE is_active = false AND updated_at < ?',
        [threshold],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
