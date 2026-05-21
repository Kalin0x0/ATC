import type { AiRuntimeRepository, AtcAiRuntime, AtcAiState, UpsertAiRuntimeParams } from './ai-runtime.repository.js'
import type { AiAuditRepository } from './ai-audit.repository.js'
import { AiEntityNotFoundError } from './errors.js'

export interface AiRuntimeEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export class AiRuntimeService {
  constructor(
    private readonly aiRuntimeRepo: AiRuntimeRepository,
    private readonly auditRepo: AiAuditRepository,
    private readonly eventBus?: AiRuntimeEventBus,
  ) {}

  async registerEntity(params: UpsertAiRuntimeParams): Promise<AtcAiRuntime> {
    const entity = await this.aiRuntimeRepo.upsert(params)
    await this.auditRepo.record(
      entity.entityId,
      'ai_entity',
      'registered',
      undefined,
      { entityType: params.entityType, aiState: params.aiState },
    )
    return entity
  }

  async updateEntityState(entityId: string, aiState: AtcAiState): Promise<AtcAiRuntime> {
    const entity = await this.aiRuntimeRepo.updateState(entityId, aiState)
    await this.auditRepo.record(entityId, 'ai_entity', 'state_changed', undefined, { aiState })
    this.eventBus?.emit('atc:ai:state:changed', { entityId, aiState }).catch(() => undefined)
    return entity
  }

  async tickEntity(entityId: string): Promise<AtcAiRuntime> {
    const entity = await this.aiRuntimeRepo.findByEntityId(entityId)
    if (!entity) {
      throw new AiEntityNotFoundError(entityId)
    }
    return this.aiRuntimeRepo.upsert({
      entityId: entity.entityId,
      entityType: entity.entityType,
      aiState: entity.aiState,
      behaviorMode: entity.behaviorMode,
      ...(entity.ownerServerId !== null ? { ownerServerId: entity.ownerServerId } : {}),
      positionData: entity.positionData,
      threatLevel: entity.threatLevel,
    })
  }

  async listActiveEntities(): Promise<AtcAiRuntime[]> {
    return this.aiRuntimeRepo.listActive()
  }

  async cleanupStaleEntities(thresholdMs: number): Promise<number> {
    const stale = await this.aiRuntimeRepo.listStale(thresholdMs)
    for (const entity of stale) {
      await this.aiRuntimeRepo.updateState(entity.entityId, 'dead')
      await this.auditRepo.record(entity.entityId, 'ai_entity', 'cleanup_dead', undefined, { thresholdMs })
    }
    return stale.length
  }
}
