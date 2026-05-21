import type { AtcEventBus } from '@atc/events'
import type { NpcRuntimeRepository, AtcNpcRuntime } from './npc-runtime.repository.js'
import type { NpcCleanupRepository } from './npc-cleanup.repository.js'
import type { NpcRuntimePool } from './pool.js'

export class NpcRuntimeService {
  constructor(
    private readonly npcRepo: NpcRuntimeRepository,
    private readonly cleanupRepo: NpcCleanupRepository,
    private readonly pool: NpcRuntimePool,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async claimOwnership(npcId: string, ownerServerId: string): Promise<AtcNpcRuntime> {
    return this.npcRepo.claimOwnership(npcId, ownerServerId)
  }

  async releaseOwnership(npcId: string): Promise<void> {
    await this.npcRepo.releaseOwnership(npcId)
  }

  async heartbeat(npcId: string): Promise<void> {
    await this.npcRepo.heartbeat(npcId)
  }

  async reconcile(activeNpcIds: string[]): Promise<number> {
    const activeSet = new Set(activeNpcIds)
    const stale = await this.npcRepo.listStale(0)
    const toClean = stale.filter(npc => !activeSet.has(npc.id))

    if (toClean.length === 0) return 0

    const ids = toClean.map(npc => npc.id)
    await this.npcRepo.markForCleanup(ids)

    for (const npc of toClean) {
      await this.cleanupRepo.record(
        npc.id,
        'reconcile',
        npc.ownerServerId ?? undefined,
      ).catch(() => undefined)

      this.eventBus?.emit('atc:npc:cleaned_up', {
        npcId: npc.id,
        reason: 'reconcile',
      }).catch(() => undefined)
    }

    await this.npcRepo.deleteByIds(ids)

    return toClean.length
  }
}
