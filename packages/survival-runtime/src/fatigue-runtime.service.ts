import type { AtcEventBus } from '@atc/events'
import type { FatigueRuntimeRepository, AtcFatigueRuntime } from './fatigue-runtime.repository.js'
import type { SurvivalRuntimePool } from './pool.js'

export class FatigueRuntimeService {
  constructor(
    private readonly fatigueRepo: FatigueRuntimeRepository,
    private readonly pool: SurvivalRuntimePool,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async recordRest(playerId: string, recoveryAmount: number): Promise<void> {
    await this.fatigueRepo.recordRest(playerId, recoveryAmount)

    this.eventBus?.emit('atc:survival:rest_completed', {
      playerId,
      recoveryAmount,
    }).catch(() => undefined)
  }

  async accumulateFatigue(playerId: string, amount: number): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_fatigue_runtime
         SET fatigue_level = LEAST(100.0, fatigue_level + ?),
             last_tick_at  = NOW(3),
             updated_at    = NOW(3)
         WHERE player_id = ?`,
        [amount, playerId],
      )
    } finally {
      conn.release()
    }
  }

  async getFatigue(playerId: string): Promise<AtcFatigueRuntime | null> {
    return this.fatigueRepo.findByPlayerId(playerId)
  }

  async listExhausted(): Promise<AtcFatigueRuntime[]> {
    return this.fatigueRepo.listExhausted(80)
  }
}
