import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { SurvivalRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { SurvivalStateNotFoundError } from './errors.js'

export type AtcSurvivalStatus = 'normal' | 'cold' | 'hot' | 'dehydrated' | 'exhausted' | 'critical'

export interface AtcSurvivalRuntime {
  id: string
  playerId: string
  bodyTemp: number
  hydrationLevel: number
  fatigueLevel: number
  survivalStatus: AtcSurvivalStatus
  penaltyFlags: string[]
  ownerServerId: string | null
  lastTickAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface SurvivalRuntimeRow extends RowDataPacket {
  id: string
  player_id: string
  body_temp: number
  hydration_level: number
  fatigue_level: number
  survival_status: string
  penalty_flags: string
  owner_server_id: string | null
  last_tick_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToSurvivalRuntime(row: SurvivalRuntimeRow): AtcSurvivalRuntime {
  let penaltyFlags: string[] = []
  try {
    const parsed: unknown = typeof row.penalty_flags === 'string'
      ? JSON.parse(row.penalty_flags)
      : row.penalty_flags
    if (Array.isArray(parsed)) {
      penaltyFlags = parsed as string[]
    }
  } catch {
    penaltyFlags = []
  }
  return {
    id: row.id,
    playerId: row.player_id,
    bodyTemp: Number(row.body_temp),
    hydrationLevel: Number(row.hydration_level),
    fatigueLevel: Number(row.fatigue_level),
    survivalStatus: row.survival_status as AtcSurvivalStatus,
    penaltyFlags,
    ownerServerId: row.owner_server_id,
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertSurvivalParams {
  bodyTemp?: number | undefined
  hydrationLevel?: number | undefined
  fatigueLevel?: number | undefined
  survivalStatus?: AtcSurvivalStatus | undefined
}

export class SurvivalRuntimeRepository {
  constructor(private readonly pool: SurvivalRuntimePool) {}

  async upsertState(
    playerId: string,
    ownerServerId: string,
    params: UpsertSurvivalParams,
  ): Promise<AtcSurvivalRuntime> {
    const id = generateId()
    const bodyTemp = params.bodyTemp ?? 37.0
    const hydrationLevel = params.hydrationLevel ?? 100.0
    const fatigueLevel = params.fatigueLevel ?? 0.0
    const survivalStatus = params.survivalStatus ?? 'normal'
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_survival_runtime
           (id, player_id, body_temp, hydration_level, fatigue_level, survival_status,
            penalty_flags, owner_server_id, last_tick_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, '[]', ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           body_temp        = VALUES(body_temp),
           hydration_level  = VALUES(hydration_level),
           fatigue_level    = VALUES(fatigue_level),
           survival_status  = VALUES(survival_status),
           owner_server_id  = VALUES(owner_server_id),
           last_tick_at     = NOW(3),
           updated_at       = NOW(3)`,
        [id, playerId, bodyTemp, hydrationLevel, fatigueLevel, survivalStatus, ownerServerId],
      )
      const [rows] = await conn.execute<SurvivalRuntimeRow[]>(
        `SELECT * FROM atc_survival_runtime WHERE player_id = ? LIMIT 1`,
        [playerId],
      )
      if (!rows[0]) throw new SurvivalStateNotFoundError(playerId)
      return rowToSurvivalRuntime(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByPlayerId(playerId: string): Promise<AtcSurvivalRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SurvivalRuntimeRow[]>(
        `SELECT * FROM atc_survival_runtime WHERE player_id = ? LIMIT 1`,
        [playerId],
      )
      return rows[0] ? rowToSurvivalRuntime(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async updateTick(
    playerId: string,
    bodyTemp: number,
    hydrationLevel: number,
    fatigueLevel: number,
    status: AtcSurvivalStatus,
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_survival_runtime
         SET body_temp       = ?,
             hydration_level = ?,
             fatigue_level   = ?,
             survival_status = ?,
             last_tick_at    = NOW(3),
             updated_at      = NOW(3)
         WHERE player_id = ?`,
        [bodyTemp, hydrationLevel, fatigueLevel, status, playerId],
      )
    } finally {
      conn.release()
    }
  }

  async applyPenalty(playerId: string, penaltyFlag: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_survival_runtime
         SET penalty_flags = JSON_ARRAY_APPEND(penalty_flags, '$', ?),
             updated_at    = NOW(3)
         WHERE player_id = ?`,
        [penaltyFlag, playerId],
      )
    } finally {
      conn.release()
    }
  }

  async listStale(thresholdMs: number): Promise<AtcSurvivalRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SurvivalRuntimeRow[]>(
        `SELECT * FROM atc_survival_runtime
         WHERE last_tick_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return rows.map(rowToSurvivalRuntime)
    } finally {
      conn.release()
    }
  }

  async deleteByPlayerIds(playerIds: string[]): Promise<number> {
    if (playerIds.length === 0) return 0
    const placeholders = playerIds.map(() => '?').join(', ')
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_survival_runtime WHERE player_id IN (${placeholders})`,
        playerIds,
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
