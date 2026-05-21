import type { AiResponseRuntimeRepository, AtcAiResponseRuntime, CreateAiResponseParams } from './ai-response-runtime.repository.js'
import type { AiAuditRepository } from './ai-audit.repository.js'
import type { AiRuntimeEventBus } from './ai-runtime.service.js'

export class TacticalResponseService {
  constructor(
    private readonly responseRepo: AiResponseRuntimeRepository,
    private readonly auditRepo: AiAuditRepository,
    private readonly eventBus?: AiRuntimeEventBus,
  ) {}

  async activateResponse(params: Omit<CreateAiResponseParams, 'responseId'> & { responseId?: string }): Promise<AtcAiResponseRuntime> {
    const created = await this.responseRepo.create(params)
    const active = await this.responseRepo.transition(created.responseId, 'active')
    await this.auditRepo.record(
      active.responseId,
      'ai_response',
      'activated',
      undefined,
      { responseType: active.responseType, entityId: active.entityId },
    )
    this.eventBus?.emit('atc:ai:tactical:response:activated', {
      responseId: active.responseId,
      responseType: active.responseType,
    }).catch(() => undefined)
    return active
  }

  async completeResponse(responseId: string): Promise<AtcAiResponseRuntime> {
    const response = await this.responseRepo.transition(responseId, 'completed')
    await this.auditRepo.record(responseId, 'ai_response', 'completed')
    return response
  }

  async withdrawResponse(responseId: string): Promise<AtcAiResponseRuntime> {
    const response = await this.responseRepo.transition(responseId, 'withdrawn')
    await this.auditRepo.record(responseId, 'ai_response', 'withdrawn')
    return response
  }

  async listActiveByEntity(entityId: string): Promise<AtcAiResponseRuntime[]> {
    return this.responseRepo.listActiveByEntity(entityId)
  }

  async cleanupStaleResponses(thresholdMs: number): Promise<number> {
    const stale = await this.responseRepo.listStale(thresholdMs)
    for (const response of stale) {
      await this.responseRepo.transition(response.responseId, 'withdrawn')
      await this.auditRepo.record(
        response.responseId,
        'ai_response',
        'cleanup_withdrawn',
        undefined,
        { thresholdMs },
      )
    }
    return stale.length
  }
}
