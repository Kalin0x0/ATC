import type { AiPatrolRepository, AtcAiPatrol, CreatePatrolParams } from './ai-patrol.repository.js'
import type { AiRuntimeRepository } from './ai-runtime.repository.js'
import type { AiAuditRepository } from './ai-audit.repository.js'
import type { AiRuntimeEventBus } from './ai-runtime.service.js'

export class AutonomousPatrolService {
  constructor(
    private readonly patrolRepo: AiPatrolRepository,
    private readonly aiRuntimeRepo: AiRuntimeRepository,
    private readonly auditRepo: AiAuditRepository,
    private readonly eventBus?: AiRuntimeEventBus,
  ) {}

  async startPatrol(params: CreatePatrolParams): Promise<AtcAiPatrol> {
    const created = await this.patrolRepo.create(params)
    const active = await this.patrolRepo.transition(created.patrolId, 'active')
    await this.aiRuntimeRepo.updateState(params.entityId, 'patrolling')
    await this.auditRepo.record(
      active.patrolId,
      'ai_patrol',
      'started',
      undefined,
      { entityId: params.entityId, patrolType: params.patrolType },
    )
    this.eventBus?.emit('atc:ai:patrol:started', {
      patrolId: active.patrolId,
      entityId: params.entityId,
    }).catch(() => undefined)
    return active
  }

  async completePatrol(patrolId: string): Promise<AtcAiPatrol> {
    const patrol = await this.patrolRepo.transition(patrolId, 'completed')
    await this.auditRepo.record(patrolId, 'ai_patrol', 'completed')
    return patrol
  }

  async abortPatrol(patrolId: string): Promise<AtcAiPatrol> {
    const patrol = await this.patrolRepo.transition(patrolId, 'aborted')
    await this.auditRepo.record(patrolId, 'ai_patrol', 'aborted')
    return patrol
  }

  async listActivePatrols(): Promise<AtcAiPatrol[]> {
    return this.patrolRepo.listActive()
  }

  async cleanupStalePatrols(thresholdMs: number): Promise<number> {
    const stale = await this.patrolRepo.listStale(thresholdMs)
    for (const patrol of stale) {
      await this.abortPatrol(patrol.patrolId)
    }
    return stale.length
  }
}
