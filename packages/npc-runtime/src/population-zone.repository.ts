import type { RowDataPacket } from 'mysql2/promise'
import type { NpcRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { PopulationZoneNotFoundError } from './errors.js'

export interface AtcPopulationZone {
  id: string
  zoneId: string
  zoneName: string
  maxPopulation: number
  currentPopulation: number
  densityMultiplier: number
  isActive: boolean
  lastTickAt: Date
  createdAt: Date
  updatedAt: Date
}

interface PopulationZoneRow extends RowDataPacket {
  id: string
  zone_id: string
  zone_name: string
  max_population: number
  current_population: number
  density_multiplier: number
  is_active: number
  last_tick_at: Date
  created_at: Date
  updated_at: Date
}

function rowToZone(row: PopulationZoneRow): AtcPopulationZone {
  return {
    id: row.id,
    zoneId: row.zone_id,
    zoneName: row.zone_name,
    maxPopulation: Number(row.max_population),
    currentPopulation: Number(row.current_population),
    densityMultiplier: Number(row.density_multiplier),
    isActive: Boolean(row.is_active),
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class PopulationZoneRepository {
  constructor(private readonly pool: NpcRuntimePool) {}

  async findByZoneId(zoneId: string): Promise<AtcPopulationZone | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PopulationZoneRow[]>(
        `SELECT * FROM atc_population_zones WHERE zone_id = ? LIMIT 1`,
        [zoneId],
      )
      return rows[0] ? rowToZone(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async upsertPopulation(
    zoneId: string,
    current: number,
    max: number,
  ): Promise<AtcPopulationZone> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_population_zones
           (id, zone_id, zone_name, max_population, current_population,
            density_multiplier, is_active, last_tick_at, created_at, updated_at)
         VALUES (?, ?, '', ?, ?, 1.0, 1, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           current_population = VALUES(current_population),
           max_population     = VALUES(max_population),
           last_tick_at       = NOW(3),
           updated_at         = NOW(3)`,
        [id, zoneId, max, current],
      )
      const [rows] = await conn.execute<PopulationZoneRow[]>(
        `SELECT * FROM atc_population_zones WHERE zone_id = ? LIMIT 1`,
        [zoneId],
      )
      if (!rows[0]) throw new PopulationZoneNotFoundError(zoneId)
      return rowToZone(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateDensity(zoneId: string, multiplier: number): Promise<AtcPopulationZone> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_population_zones
         SET density_multiplier = ?, updated_at = NOW(3)
         WHERE zone_id = ?`,
        [multiplier, zoneId],
      )
      const [rows] = await conn.execute<PopulationZoneRow[]>(
        `SELECT * FROM atc_population_zones WHERE zone_id = ? LIMIT 1`,
        [zoneId],
      )
      if (!rows[0]) throw new PopulationZoneNotFoundError(zoneId)
      return rowToZone(rows[0])
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcPopulationZone[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PopulationZoneRow[]>(
        `SELECT * FROM atc_population_zones WHERE is_active = 1 ORDER BY zone_id ASC`,
      )
      return rows.map(rowToZone)
    } finally {
      conn.release()
    }
  }
}
