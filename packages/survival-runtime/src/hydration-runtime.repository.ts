import type { RowDataPacket } from 'mysql2/promise'
import type { SurvivalRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { HydrationStateNotFoundError } from './errors.js'

export interface AtcHydrationRuntime {
  id: string
  playerId: string
  hydrationLevel: number
  depletionRate: number
  lastDrinkAt: Date | null
  lastTickAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface HydrationRuntimeRow extends RowDataPacket {
  id: string
  player_id: string
  hydration_level: number
  depletion_rate: number
  last_drink_at: Date | null
  last_tick_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToHydrationRuntime(row: HydrationRuntimeRow): AtcHydrationRuntime {
  return {
    id: row.id,
    playerId: row.player_id,
    hydrationLevel: Number(row.hydration_level),
    depletionRate: Number(row.depletion_rate),
    lastDrinkAt: row.last_drink_at,
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class HydrationRuntimeRepository {
  constructor(private readonly pool: SurvivalRuntimePool) {}

  async upsert(
    playerId: string,
    hydrationLevel: number,
    depletionRate: number,
  ): Promise<AtcHydrationRuntime> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_hydration_runtime
           (id, player_id, hydration_level, depletion_rate, last_drink_at, last_tick_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           hydration_level = VALUES(hydration_level),
           depletion_rate  = VALUES(depletion_rate),
           last_tick_at    = NOW(3),
           updated_at      = NOW(3)`,
        [id, playerId, hydrationLevel, depletionRate],
      )
      const [rows] = await conn.execute<HydrationRuntimeRow[]>(
        `SELECT * FROM atc_hydration_runtime WHERE player_id = ? LIMIT 1`,
        [playerId],
      )
      if (!rows[0]) throw new HydrationStateNotFoundError(playerId)
      return rowToHydrationRuntime(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByPlayerId(playerId: string): Promise<AtcHydrationRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<HydrationRuntimeRow[]>(
        `SELECT * FROM atc_hydration_runtime WHERE player_id = ? LIMIT 1`,
        [playerId],
      )
      return rows[0] ? rowToHydrationRuntime(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async recordDrink(playerId: string, amount: number): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_hydration_runtime
         SET hydration_level = LEAST(100.0, hydration_level + ?),
             last_drink_at   = NOW(3),
             last_tick_at    = NOW(3),
             updated_at      = NOW(3)
         WHERE player_id = ?`,
        [amount, playerId],
      )
    } finally {
      conn.release()
    }
  }

  async listBelowThreshold(threshold: number): Promise<AtcHydrationRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<HydrationRuntimeRow[]>(
        `SELECT * FROM atc_hydration_runtime WHERE hydration_level < ?`,
        [threshold],
      )
      return rows.map(rowToHydrationRuntime)
    } finally {
      conn.release()
    }
  }
}
