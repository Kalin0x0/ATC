import type { ShardRuntimeRepository, AtcShardRuntime, UpsertShardParams } from './shard-runtime.repository.js'
import type { RuntimeAllocationRepository } from './runtime-allocation.repository.js'
import type { WorldOrchestrationAuditRepository } from './world-orchestration-audit.repository.js'
import type { WorldOrchestratorEventBus } from './world-orchestrator.service.js'

export class DistributedShardService {
  constructor(
    private readonly shardRepo: ShardRuntimeRepository,
    private readonly allocationRepo: RuntimeAllocationRepository,
    private readonly auditRepo: WorldOrchestrationAuditRepository,
    private readonly eventBus?: WorldOrchestratorEventBus | undefined,
  ) {}

  async allocateShard(params: UpsertShardParams): Promise<AtcShardRuntime> {
    const shard = await this.shardRepo.upsert(params)

    await this.allocationRepo.create({
      shardId: shard.shardId,
      serverId: shard.ownerServerId,
      allocationType: 'initial',
    })

    await this.auditRepo.record(shard.shardId, 'shard:allocated', shard.ownerServerId, {
      shardType: shard.shardType,
      regionId: shard.regionId,
    })

    this.eventBus
      ?.emit('atc:orchestrator:shard:allocated', {
        shardId: shard.shardId,
        shardType: shard.shardType,
        ownerServerId: shard.ownerServerId,
        regionId: shard.regionId,
      })
      .catch(() => undefined)

    return shard
  }

  async transferShard(
    shardId: string,
    fromServerId: string,
    toServerId: string,
  ): Promise<AtcShardRuntime> {
    const shard = await this.shardRepo.transfer(shardId, fromServerId, toServerId)

    await this.allocationRepo.create({
      shardId: shard.shardId,
      serverId: toServerId,
      allocationType: 'migration',
      allocationData: { fromServerId, toServerId },
    })

    await this.auditRepo.record(shardId, 'shard:transferred', toServerId, {
      fromServerId,
      toServerId,
    })

    this.eventBus
      ?.emit('atc:orchestrator:shard:transferred', {
        shardId,
        fromServerId,
        toServerId,
      })
      .catch(() => undefined)

    return shard
  }

  async listActiveShards(): Promise<AtcShardRuntime[]> {
    return this.shardRepo.listActive()
  }

  async cleanupStaleShards(thresholdMs: number): Promise<number> {
    const stale = await this.shardRepo.listStale(thresholdMs)
    let count = 0

    for (const shard of stale) {
      await this.shardRepo.deactivate(shard.shardId)
      await this.auditRepo.record(shard.shardId, 'shard:stale:deactivated', shard.ownerServerId, {
        thresholdMs,
      })
      count++
    }

    if (count > 0) {
      this.eventBus
        ?.emit('atc:orchestrator:shard:cleanup', { count, thresholdMs })
        .catch(() => undefined)
    }

    return count
  }
}
