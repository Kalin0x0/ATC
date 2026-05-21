import type { RowDataPacket } from 'mysql2/promise'
import type { SurvivalRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { FatigueStateNotFoundError } from './errors.js'

export interface AtcFatigueRuntime {
  id: string
  playerId: string
  fatigueLevel: number
  restDebt: number
  lastRestAt: Date | null
  lastTickAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface FatigueRuntimeRow extends RowDataPacket {
  id: string
  player_id: string
  fatigue_level: number
  rest_debt: number
  last_rest_at: Date | null
  last_tick_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToFatigueRuntime(row: FatigueRuntimeRow): AtcFatigueRuntime {
  return {
    id: row.id,
    playerId: row.player_id,
    fatigueLevel: Number(row.fatigue_level),
    restDebt: Number(row.rest_debt),
    lastRestAt: row.last_rest_at,
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class FatigueRuntimeRepository {
  constructor(private readonly pool: SurvivalRuntimePool) {}

  async upsert(
    playerId: string,
    fatigueLevel: number,
    restDebt: number,
  ): Promise<AtcFatigueRuntime> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_fatigue_runtime
           (id, player_id, fatigue_level, rest_debt, last_rest_at, last_tick_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           fatigue_level = VALUES(fatigue_level),
           rest_debt     = VALUES(rest_debt),
           last_tick_at  = NOW(3),
           updated_at    = NOW(3)`,
        [id, playerId, fatigueLevel, restDebt],
      )
      const [rows] = await conn.execute<FatigueRuntimeRow[]>(
        `SELECT * FROM atc_fatigue_runtime WHERE player_id = ? LIMIT 1`,
        [playerId],
      )
      if (!rows[0]) throw new FatigueStateNotFoundError(playerId)
      return rowToFatigueRuntime(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByPlayerId(playerId: string): Promise<AtcFatigueRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FatigueRuntimeRow[]>(
        `SELECT * FROM atc_fatigue_runtime WHERE player_id = ? LIMIT 1`,
        [playerId],
      )
      return rows[0] ? rowToFatigueRuntime(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async recordRest(playerId: string, recoveryAmount: number): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_fatigue_runtime
         SET fatigue_level = GREATEST(0.0, fatigue_level - ?),
             last_rest_at  = NOW(3),
             last_tick_at  = NOW(3),
             updated_at    = NOW(3)
         WHERE player_id = ?`,
        [recoveryAmount, playerId],
      )
    } finally {
      conn.release()
    }
  }

  async listExhausted(threshold: number): Promise<AtcFatigueRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FatigueRuntimeRow[]>(
        `SELECT * FROM atc_fatigue_runtime WHERE fatigue_level > ?`,
        [threshold],
      )
      return rows.map(rowToFatigueRuntime)
    } finally {
      conn.release()
    }
  }
}
