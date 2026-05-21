import type { AtcEventBus } from '@atc/events'
import type { NpcBehaviorRepository, AtcNpcBehavior } from './npc-behavior.repository.js'
import type { NpcRuntimeRepository } from './npc-runtime.repository.js'
import { NpcNotFoundError } from './errors.js'

export class AmbientBehaviorService {
  constructor(
    private readonly behaviorRepo: NpcBehaviorRepository,
    private readonly npcRepo: NpcRuntimeRepository,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async recordBehavior(
    npcId: string,
    behavior: string,
    params?: Record<string, unknown> | undefined,
  ): Promise<AtcNpcBehavior> {
    const npc = await this.npcRepo.findById(npcId)
    if (!npc) throw new NpcNotFoundError(npcId)

    // End any existing behavior before recording new one
    await this.behaviorRepo.endCurrent(npcId)

    const record = await this.behaviorRepo.record(npcId, behavior, params)

    this.eventBus?.emit('atc:npc:behavior_changed', {
      npcId,
      behavior,
    }).catch(() => undefined)

    return record
  }

  async getCurrentBehavior(npcId: string): Promise<AtcNpcBehavior | null> {
    return this.behaviorRepo.findCurrentByNpc(npcId)
  }
}
