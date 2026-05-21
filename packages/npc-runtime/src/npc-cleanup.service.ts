import type { AtcEventBus } from '@atc/events'
import type { NpcRuntimeRepository } from './npc-runtime.repository.js'
import type { NpcCleanupRepository, AtcNpcCleanup } from './npc-cleanup.repository.js'
import type { NpcRuntimePool } from './pool.js'

export class NpcCleanupService {
  constructor(
    private readonly npcRepo: NpcRuntimeRepository,
    private readonly cleanupRepo: NpcCleanupRepository,
    private readonly pool: NpcRuntimePool,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async cleanupStale(olderThanMinutes: number): Promise<number> {
    const stale = await this.npcRepo.listStale(olderThanMinutes)
    if (stale.length === 0) return 0

    const ids = stale.map(npc => npc.id)
    await this.npcRepo.markForCleanup(ids)

    for (const npc of stale) {
      await this.cleanupRepo.record(
        npc.id,
        'stale_timeout',
        npc.ownerServerId ?? undefined,
      ).catch(() => undefined)

      this.eventBus?.emit('atc:npc:cleaned_up', {
        npcId: npc.id,
        reason: 'stale_timeout',
      }).catch(() => undefined)
    }

    await this.npcRepo.deleteByIds(ids)

    return stale.length
  }

  async getRecentCleanups(limit?: number | undefined): Promise<AtcNpcCleanup[]> {
    return this.cleanupRepo.listRecent(limit)
  }
}
