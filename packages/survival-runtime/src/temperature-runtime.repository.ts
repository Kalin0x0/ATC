import type { RowDataPacket } from 'mysql2/promise'
import type { SurvivalRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { TemperatureStateNotFoundError } from './errors.js'

export interface AtcTemperatureRuntime {
  id: string
  playerId: string
  currentTemp: number
  tempTrend: number
  exposureZone: string | null
  lastTickAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface TemperatureRuntimeRow extends RowDataPacket {
  id: string
  player_id: string
  current_temp: number
  temp_trend: number
  exposure_zone: string | null
  last_tick_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToTemperatureRuntime(row: TemperatureRuntimeRow): AtcTemperatureRuntime {
  return {
    id: row.id,
    playerId: row.player_id,
    currentTemp: Number(row.current_temp),
    tempTrend: Number(row.temp_trend),
    exposureZone: row.exposure_zone,
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class TemperatureRuntimeRepository {
  constructor(private readonly pool: SurvivalRuntimePool) {}

  async upsert(
    playerId: string,
    currentTemp: number,
    tempTrend: number,
    exposureZone?: string | undefined,
  ): Promise<AtcTemperatureRuntime> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_temperature_runtime
           (id, player_id, current_temp, temp_trend, exposure_zone, last_tick_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           current_temp  = VALUES(current_temp),
           temp_trend    = VALUES(temp_trend),
           exposure_zone = VALUES(exposure_zone),
           last_tick_at  = NOW(3),
           updated_at    = NOW(3)`,
        [id, playerId, currentTemp, tempTrend, exposureZone ?? null],
      )
      const [rows] = await conn.execute<TemperatureRuntimeRow[]>(
        `SELECT * FROM atc_temperature_runtime WHERE player_id = ? LIMIT 1`,
        [playerId],
      )
      if (!rows[0]) throw new TemperatureStateNotFoundError(playerId)
      return rowToTemperatureRuntime(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByPlayerId(playerId: string): Promise<AtcTemperatureRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TemperatureRuntimeRow[]>(
        `SELECT * FROM atc_temperature_runtime WHERE player_id = ? LIMIT 1`,
        [playerId],
      )
      return rows[0] ? rowToTemperatureRuntime(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async updateTick(
    playerId: string,
    currentTemp: number,
    tempTrend: number,
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_temperature_runtime
         SET current_temp = ?,
             temp_trend   = ?,
             last_tick_at = NOW(3),
             updated_at   = NOW(3)
         WHERE player_id = ?`,
        [currentTemp, tempTrend, playerId],
      )
    } finally {
      conn.release()
    }
  }
}
