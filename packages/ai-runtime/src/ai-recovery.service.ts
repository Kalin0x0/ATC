import type { AiRuntimeRepository } from './ai-runtime.repository.js'
import type { AiPatrolRepository } from './ai-patrol.repository.js'
import type { AiResponseRuntimeRepository } from './ai-response-runtime.repository.js'
import type { AiAuditRepository } from './ai-audit.repository.js'
import type { AiRuntimeEventBus } from './ai-runtime.service.js'
import { AiEntityNotFoundError } from './errors.js'

export interface FullCleanupResult {
  entities: number
  patrols: number
  responses: number
}

export class AiRecoveryService {
  constructor(
    private readonly aiRuntimeRepo: AiRuntimeRepository,
    private readonly patrolRepo: AiPatrolRepository,
    private readonly responseRepo: AiResponseRuntimeRepository,
    private readonly auditRepo: AiAuditRepository,
    private readonly eventBus?: AiRuntimeEventBus,
  ) {}

  async recoverEntity(entityId: string): Promise<void> {
    const entity = await this.aiRuntimeRepo.findByEntityId(entityId)
    if (!entity) {
      throw new AiEntityNotFoundError(entityId)
    }
    await this.aiRuntimeRepo.updateState(entityId, 'recovering')
    await this.auditRepo.record(entityId, 'ai_entity', 'recovered')
    this.eventBus?.emit('atc:ai:runtime:recovered', { entityId }).catch(() => undefined)
  }

  async fullCleanup(thresholdMs: number): Promise<FullCleanupResult> {
    // Stale entities → dead
    const staleEntities = await this.aiRuntimeRepo.listStale(thresholdMs)
    for (const entity of staleEntities) {
      await this.aiRuntimeRepo.updateState(entity.entityId, 'dead')
      await this.auditRepo.record(
        entity.entityId,
        'ai_entity',
        'cleanup_dead',
        undefined,
        { thresholdMs },
      )
    }

    // Stale patrols → aborted
    const stalePatrols = await this.patrolRepo.listStale(thresholdMs)
    for (const patrol of stalePatrols) {
      await this.patrolRepo.transition(patrol.patrolId, 'aborted')
      await this.auditRepo.record(
        patrol.patrolId,
        'ai_patrol',
        'cleanup_aborted',
        undefined,
        { thresholdMs },
      )
    }

    // Stale responses → withdrawn
    const staleResponses = await this.responseRepo.listStale(thresholdMs)
    for (const response of staleResponses) {
      await this.responseRepo.transition(response.responseId, 'withdrawn')
      await this.auditRepo.record(
        response.responseId,
        'ai_response',
        'cleanup_withdrawn',
        undefined,
        { thresholdMs },
      )
    }

    return {
      entities: staleEntities.length,
      patrols: stalePatrols.length,
      responses: staleResponses.length,
    }
  }
}
