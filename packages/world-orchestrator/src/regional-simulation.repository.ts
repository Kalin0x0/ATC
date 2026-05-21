import type { RowDataPacket } from 'mysql2/promise'
import type { WorldOrchestratorPool } from './pool.js'
import { generateId } from './id.js'
import { RegionalSimulationNotFoundError } from './errors.js'

export type AtcSimulationType = 'full' | 'partial' | 'minimal' | 'frozen'

export interface AtcRegionalSimulation {
  id: string
  regionId: string
  simulationType: AtcSimulationType
  ownerServerId: string | null
  simulationData: Record<string, unknown>
  isActive: boolean
  lastTickAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertSimulationParams {
  regionId: string
  simulationType: AtcSimulationType
  ownerServerId?: string | undefined
  simulationData?: Record<string, unknown> | undefined
}

interface AtcRegionalSimulationRow extends RowDataPacket {
  id: string
  region_id: string
  simulation_type: string
  owner_server_id: string | null
  simulation_data: string
  is_active: number
  last_tick_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: AtcRegionalSimulationRow): AtcRegionalSimulation {
  return {
    id: row.id,
    regionId: row.region_id,
    simulationType: row.simulation_type as AtcSimulationType,
    ownerServerId: row.owner_server_id,
    simulationData: JSON.parse(row.simulation_data) as Record<string, unknown>,
    isActive: row.is_active === 1,
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RegionalSimulationRepository {
  constructor(private readonly pool: WorldOrchestratorPool) {}

  async findByRegionId(regionId: string): Promise<AtcRegionalSimulation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcRegionalSimulationRow[]>(
        `SELECT id, region_id, simulation_type, owner_server_id, simulation_data,
                is_active, last_tick_at, created_at, updated_at
         FROM atc_regional_simulation
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

  async upsert(params: UpsertSimulationParams): Promise<AtcRegionalSimulation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const simulationData = JSON.stringify(params.simulationData ?? {})
      const binds: (string | number | boolean | null)[] = [
        id,
        params.regionId,
        params.simulationType,
        params.ownerServerId ?? null,
        simulationData,
      ]

      await conn.execute(
        `INSERT INTO atc_regional_simulation
           (id, region_id, simulation_type, owner_server_id, simulation_data, last_tick_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           simulation_type  = VALUES(simulation_type),
           owner_server_id  = VALUES(owner_server_id),
           simulation_data  = VALUES(simulation_data),
           is_active        = 1,
           updated_at       = NOW(3)`,
        binds,
      )

      const result = await this.findByRegionId(params.regionId)
      if (!result) throw new RegionalSimulationNotFoundError(params.regionId)
      return result
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcRegionalSimulation[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcRegionalSimulationRow[]>(
        `SELECT id, region_id, simulation_type, owner_server_id, simulation_data,
                is_active, last_tick_at, created_at, updated_at
         FROM atc_regional_simulation
         WHERE is_active = 1
         ORDER BY created_at ASC`,
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
        `UPDATE atc_regional_simulation
         SET is_active = 0, updated_at = NOW(3)
         WHERE region_id = ?`,
        [regionId],
      )
    } finally {
      conn.release()
    }
  }
}
