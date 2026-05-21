import type { AtcEventBus } from '@atc/events'
import type { HydrationRuntimeRepository, AtcHydrationRuntime } from './hydration-runtime.repository.js'
import type { SurvivalRuntimePool } from './pool.js'

export class HydrationRuntimeService {
  constructor(
    private readonly hydrationRepo: HydrationRuntimeRepository,
    private readonly pool: SurvivalRuntimePool,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async recordDrink(playerId: string, amount: number): Promise<void> {
    await this.hydrationRepo.recordDrink(playerId, amount)

    this.eventBus?.emit('atc:survival:hydration_restored', {
      playerId,
      amount,
    }).catch(() => undefined)
  }

  async depleteHydration(playerId: string, amount: number): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_hydration_runtime
         SET hydration_level = GREATEST(0.0, hydration_level - ?),
             last_tick_at    = NOW(3),
             updated_at      = NOW(3)
         WHERE player_id = ?`,
        [amount, playerId],
      )
    } finally {
      conn.release()
    }
  }

  async getHydration(playerId: string): Promise<AtcHydrationRuntime | null> {
    return this.hydrationRepo.findByPlayerId(playerId)
  }

  async listCritical(): Promise<AtcHydrationRuntime[]> {
    return this.hydrationRepo.listBelowThreshold(20)
  }
}
