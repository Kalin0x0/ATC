import type { RowDataPacket } from 'mysql2/promise'
import type { CityRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { EnvironmentRuntimeNotFoundError } from './errors.js'

export type AtcWeatherType =
  | 'clear'
  | 'cloudy'
  | 'rain'
  | 'thunder'
  | 'snow'
  | 'fog'
  | 'smog'
  | 'overcast'

export type AtcTimeOfDay =
  | 'dawn'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'night'
  | 'midnight'

export interface AtcEnvironmentRuntime {
  id: string
  regionId: string
  weather: AtcWeatherType
  timeOfDay: AtcTimeOfDay
  temperature: number
  windSpeed: number
  visibility: number
  isEmergencyWeather: boolean
  activeEventId: string | null
  lastTickAt: Date
  createdAt: Date
  updatedAt: Date
}

interface EnvironmentRow extends RowDataPacket {
  id: string
  region_id: string
  weather: string
  time_of_day: string
  temperature: number
  wind_speed: number
  visibility: number
  is_emergency_weather: number | boolean
  active_event_id: string | null
  last_tick_at: Date
  created_at: Date
  updated_at: Date
}

function rowToEnvironment(row: EnvironmentRow): AtcEnvironmentRuntime {
  return {
    id: row.id,
    regionId: row.region_id,
    weather: row.weather as AtcWeatherType,
    timeOfDay: row.time_of_day as AtcTimeOfDay,
    temperature: Number(row.temperature),
    windSpeed: Number(row.wind_speed),
    visibility: Number(row.visibility),
    isEmergencyWeather: Boolean(row.is_emergency_weather),
    activeEventId: row.active_event_id,
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertEnvironmentParams {
  weather?: AtcWeatherType | undefined
  timeOfDay?: AtcTimeOfDay | undefined
  temperature?: number | undefined
  windSpeed?: number | undefined
  visibility?: number | undefined
  isEmergencyWeather?: boolean | undefined
  activeEventId?: string | null | undefined
}

export class EnvironmentRuntimeRepository {
  constructor(private readonly pool: CityRuntimePool) {}

  async upsert(regionId: string, params: UpsertEnvironmentParams): Promise<AtcEnvironmentRuntime> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      // Ensure the row exists with defaults
      await conn.execute(
        `INSERT INTO atc_environment_runtime
           (id, region_id, weather, time_of_day, temperature, wind_speed, visibility,
            is_emergency_weather, active_event_id, last_tick_at, created_at, updated_at)
         VALUES (?, ?, 'clear', 'morning', 20, 0, 100, 0, NULL, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE last_tick_at = NOW(3), updated_at = NOW(3)`,
        [id, regionId],
      )

      // Build the update from provided params using conditional spreads
      const setClauses: string[] = ['last_tick_at = NOW(3)', 'updated_at = NOW(3)']
      const binds: (string | number | boolean | null)[] = []

      if (params.weather !== undefined) {
        setClauses.push('weather = ?')
        binds.push(params.weather)
      }
      if (params.timeOfDay !== undefined) {
        setClauses.push('time_of_day = ?')
        binds.push(params.timeOfDay)
      }
      if (params.temperature !== undefined) {
        setClauses.push('temperature = ?')
        binds.push(params.temperature)
      }
      if (params.windSpeed !== undefined) {
        setClauses.push('wind_speed = ?')
        binds.push(params.windSpeed)
      }
      if (params.visibility !== undefined) {
        setClauses.push('visibility = ?')
        binds.push(params.visibility)
      }
      if (params.isEmergencyWeather !== undefined) {
        setClauses.push('is_emergency_weather = ?')
        binds.push(params.isEmergencyWeather)
      }
      if (params.activeEventId !== undefined) {
        setClauses.push('active_event_id = ?')
        binds.push(params.activeEventId)
      }

      if (binds.length > 0) {
        binds.push(regionId)
        await conn.execute(
          `UPDATE atc_environment_runtime SET ${setClauses.join(', ')} WHERE region_id = ?`,
          binds,
        )
      }

      const [rows] = await conn.execute<EnvironmentRow[]>(
        `SELECT * FROM atc_environment_runtime WHERE region_id = ? LIMIT 1`,
        [regionId],
      )
      if (!rows[0]) throw new EnvironmentRuntimeNotFoundError(regionId)
      return rowToEnvironment(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByRegion(regionId: string): Promise<AtcEnvironmentRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EnvironmentRow[]>(
        `SELECT * FROM atc_environment_runtime WHERE region_id = ? LIMIT 1`,
        [regionId],
      )
      return rows[0] ? rowToEnvironment(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcEnvironmentRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EnvironmentRow[]>(
        `SELECT * FROM atc_environment_runtime ORDER BY region_id ASC`,
      )
      return rows.map(rowToEnvironment)
    } finally {
      conn.release()
    }
  }
}
