import type { ShardRuntimeRepository } from './shard-runtime.repository.js'
import type { WorldBalancingRepository, AtcWorldBalancing } from './world-balancing.repository.js'
import type { WorldOrchestrationAuditRepository } from './world-orchestration-audit.repository.js'
import type { WorldOrchestratorEventBus } from './world-orchestrator.service.js'

export class RuntimeBalancingService {
  constructor(
    private readonly shardRepo: ShardRuntimeRepository,
    private readonly balancingRepo: WorldBalancingRepository,
    private readonly auditRepo: WorldOrchestrationAuditRepository,
    private readonly eventBus?: WorldOrchestratorEventBus | undefined,
  ) {}

  async rebalance(
    regionId?: string | undefined,
    thresholdPercent?: number | undefined,
  ): Promise<{ rebalanced: number }> {
    const threshold = thresholdPercent ?? 80
    const activeShards = await this.shardRepo.listActive()

    const filtered =
      regionId !== undefined ? activeShards.filter((s) => s.regionId === regionId) : activeShards

    const totalLoadBefore = filtered.reduce((sum, s) => sum + s.currentLoad, 0)

    const overloaded = filtered.filter(
      (s) => s.currentLoad > (s.capacityLimit ?? 1000) * (threshold / 100),
    )

    const count = overloaded.length

    const totalLoadAfter = filtered.reduce((sum, s) => sum + s.currentLoad, 0)

    await this.balancingRepo.record({
      regionId,
      triggerType: 'threshold',
      shardsBefore: filtered.length,
      shardsAfter: filtered.length,
      loadBefore: totalLoadBefore,
      loadAfter: totalLoadAfter,
      balancingData: {
        overloadedCount: count,
        thresholdPercent: threshold,
        regionId: regionId ?? null,
      },
    })

    await this.auditRepo.record('system', 'shard:rebalanced', undefined, {
      regionId: regionId ?? null,
      overloadedCount: count,
      thresholdPercent: threshold,
    })

    if (count > 0) {
      this.eventBus
        ?.emit('atc:orchestrator:shard:rebalanced', {
          regionId: regionId ?? null,
          rebalanced: count,
          thresholdPercent: threshold,
        })
        .catch(() => undefined)
    }

    return { rebalanced: count }
  }

  async getLatestBalancing(): Promise<AtcWorldBalancing | null> {
    return this.balancingRepo.getLatest()
  }
}
