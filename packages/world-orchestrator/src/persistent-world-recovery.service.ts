import type { ShardRuntimeRepository } from './shard-runtime.repository.js'
import type { RegionalSimulationRepository } from './regional-simulation.repository.js'
import type { WorldOrchestrationAuditRepository } from './world-orchestration-audit.repository.js'
import type { WorldOrchestratorEventBus } from './world-orchestrator.service.js'

const DEFAULT_STALE_THRESHOLD_MS = 300_000

export class PersistentWorldRecoveryService {
  constructor(
    private readonly shardRepo: ShardRuntimeRepository,
    private readonly simulationRepo: RegionalSimulationRepository,
    private readonly auditRepo: WorldOrchestrationAuditRepository,
    private readonly eventBus?: WorldOrchestratorEventBus | undefined,
  ) {}

  async recover(
    shardId?: string | undefined,
    regionId?: string | undefined,
  ): Promise<{ recovered: number }> {
    let recovered = 0

    // Recover stale shards
    const staleShards = await this.shardRepo.listStale(DEFAULT_STALE_THRESHOLD_MS)

    for (const shard of staleShards) {
      if (shardId !== undefined && shard.shardId !== shardId) continue
      if (regionId !== undefined && shard.regionId !== regionId) continue

      await this.shardRepo.deactivate(shard.shardId)
      await this.auditRepo.record(shard.shardId, 'shard:recovered', shard.ownerServerId, {
        reason: 'stale',
        thresholdMs: DEFAULT_STALE_THRESHOLD_MS,
      })
      recovered++
    }

    // Recover stale simulations
    const activeSimulations = await this.simulationRepo.listActive()

    for (const sim of activeSimulations) {
      if (regionId !== undefined && sim.regionId !== regionId) continue

      const ageMs = Date.now() - sim.lastTickAt.getTime()
      if (ageMs < DEFAULT_STALE_THRESHOLD_MS) continue

      await this.simulationRepo.deactivate(sim.regionId)
      await this.auditRepo.record(sim.regionId, 'simulation:recovered', sim.ownerServerId ?? undefined, {
        reason: 'stale',
        ageMs,
        thresholdMs: DEFAULT_STALE_THRESHOLD_MS,
      })
      recovered++
    }

    if (recovered > 0) {
      this.eventBus
        ?.emit('atc:orchestrator:world:recovered', {
          recovered,
          shardId: shardId ?? null,
          regionId: regionId ?? null,
        })
        .catch(() => undefined)
    }

    return { recovered }
  }

  async cleanupStaleShards(thresholdMs: number): Promise<number> {
    const stale = await this.shardRepo.listStale(thresholdMs)
    let count = 0

    for (const shard of stale) {
      await this.shardRepo.deactivate(shard.shardId)
      await this.auditRepo.record(shard.shardId, 'shard:stale:cleanup', shard.ownerServerId, {
        thresholdMs,
      })
      count++
    }

    return count
  }
}
