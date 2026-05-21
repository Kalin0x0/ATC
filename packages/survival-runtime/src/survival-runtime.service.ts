import type { AtcEventBus } from '@atc/events'
import type { SurvivalRuntimeRepository, AtcSurvivalRuntime } from './survival-runtime.repository.js'
import type { TemperatureRuntimeRepository } from './temperature-runtime.repository.js'
import type { HydrationRuntimeRepository } from './hydration-runtime.repository.js'
import type { FatigueRuntimeRepository } from './fatigue-runtime.repository.js'
import type { SurvivalRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { SurvivalStateNotFoundError } from './errors.js'

export interface TickParams {
  bodyTemp: number
  hydrationLevel: number
  fatigueLevel: number
  survivalStatus: AtcSurvivalRuntime['survivalStatus']
  tempTrend?: number | undefined
  depletionRate?: number | undefined
  restDebt?: number | undefined
  exposureZone?: string | undefined
}

export class SurvivalRuntimeService {
  constructor(
    private readonly survivalRepo: SurvivalRuntimeRepository,
    private readonly tempRepo: TemperatureRuntimeRepository,
    private readonly hydrationRepo: HydrationRuntimeRepository,
    private readonly fatigueRepo: FatigueRuntimeRepository,
    private readonly pool: SurvivalRuntimePool,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async tick(
    playerId: string,
    ownerServerId: string,
    params: TickParams,
  ): Promise<AtcSurvivalRuntime> {
    const survivalId = generateId()
    const tempId = generateId()
    const hydrationId = generateId()
    const fatigueId = generateId()

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
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
          [
            survivalId,
            playerId,
            params.bodyTemp,
            params.hydrationLevel,
            params.fatigueLevel,
            params.survivalStatus,
            ownerServerId,
          ],
        )

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
          [
            tempId,
            playerId,
            params.bodyTemp,
            params.tempTrend ?? 0.0,
            params.exposureZone ?? null,
          ],
        )

        await conn.execute(
          `INSERT INTO atc_hydration_runtime
             (id, player_id, hydration_level, depletion_rate, last_drink_at, last_tick_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, NOW(3), NOW(3), NOW(3))
           ON DUPLICATE KEY UPDATE
             hydration_level = VALUES(hydration_level),
             depletion_rate  = VALUES(depletion_rate),
             last_tick_at    = NOW(3),
             updated_at      = NOW(3)`,
          [hydrationId, playerId, params.hydrationLevel, params.depletionRate ?? 0.1],
        )

        await conn.execute(
          `INSERT INTO atc_fatigue_runtime
             (id, player_id, fatigue_level, rest_debt, last_rest_at, last_tick_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, NOW(3), NOW(3), NOW(3))
           ON DUPLICATE KEY UPDATE
             fatigue_level = VALUES(fatigue_level),
             rest_debt     = VALUES(rest_debt),
             last_tick_at  = NOW(3),
             updated_at    = NOW(3)`,
          [fatigueId, playerId, params.fatigueLevel, params.restDebt ?? 0.0],
        )

        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }

    const survivalState = await this.survivalRepo.findByPlayerId(playerId)
    if (!survivalState) throw new SurvivalStateNotFoundError(playerId)

    this.eventBus?.emit('atc:survival:tick_applied', {
      playerId,
      bodyTemp: params.bodyTemp,
      hydrationLevel: params.hydrationLevel,
      fatigueLevel: params.fatigueLevel,
      survivalStatus: params.survivalStatus,
    }).catch(() => undefined)

    return survivalState
  }

  async applyPenalty(
    playerId: string,
    penaltyFlag: string,
    reason: string,
  ): Promise<void> {
    await this.survivalRepo.applyPenalty(playerId, penaltyFlag)

    this.eventBus?.emit('atc:survival:penalty_applied', {
      playerId,
      penaltyFlag,
      reason,
    }).catch(() => undefined)
  }

  async reconcile(activePlayerIds: string[]): Promise<number> {
    const activeSet = new Set(activePlayerIds)
    const staleRecords = await this.survivalRepo.listStale(60_000)
    const toDelete = staleRecords
      .map((r) => r.playerId)
      .filter((id) => !activeSet.has(id))
    if (toDelete.length === 0) return 0
    return this.survivalRepo.deleteByPlayerIds(toDelete)
  }
}
