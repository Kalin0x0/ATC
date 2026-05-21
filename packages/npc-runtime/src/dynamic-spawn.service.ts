import type { AtcEventBus } from '@atc/events'
import type { NpcRuntimeRepository, AtcNpcRuntime, SpawnNpcParams } from './npc-runtime.repository.js'
import type { NpcSpawnPointRepository } from './spawn-point.repository.js'
import type { NpcCleanupRepository } from './npc-cleanup.repository.js'
import type { NpcRuntimePool } from './pool.js'
import { NpcNotFoundError } from './errors.js'

export class DynamicSpawnService {
  constructor(
    private readonly npcRepo: NpcRuntimeRepository,
    private readonly spawnPointRepo: NpcSpawnPointRepository,
    private readonly cleanupRepo: NpcCleanupRepository,
    private readonly pool: NpcRuntimePool,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async spawnNpc(params: SpawnNpcParams): Promise<AtcNpcRuntime> {
    // Idempotency: check if nonce already exists
    const existing = await this.npcRepo.findByNonce(params.spawnNonce)
    if (existing) return existing

    const npc = await this.npcRepo.spawn(params)

    this.eventBus?.emit('atc:npc:spawned', {
      npcId: npc.id,
      spawnNonce: npc.spawnNonce,
      npcType: npc.npcType,
      zoneId: npc.zoneId,
    }).catch(() => undefined)

    return npc
  }

  async despawnNpc(
    npcId: string,
    despawnedByOwner?: string | undefined,
  ): Promise<void> {
    const npc = await this.npcRepo.findById(npcId)
    if (!npc) throw new NpcNotFoundError(npcId)

    await this.npcRepo.despawn(npcId)

    await this.cleanupRepo.record(
      npcId,
      'despawned',
      despawnedByOwner,
    )

    this.eventBus?.emit('atc:npc:cleaned_up', {
      npcId,
      reason: 'despawned',
    }).catch(() => undefined)
  }
}
