import type { AtcEventBus } from '@atc/events'
import type { RecoveryRuntimeRepository } from './recovery-runtime.repository.js'
import type { DisasterAuditRepository } from './disaster-audit.repository.js'
import type { AtcRecoveryRuntime } from './recovery-runtime.repository.js'

export interface StartRecoveryParams {
  recoveryPhase: string
  progressPercent: number
  estimatedCompletionAt?: Date | undefined
}

export class RecoveryOrchestrationService {
  private readonly recoveryRepo: RecoveryRuntimeRepository
  private readonly auditRepo: DisasterAuditRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(
    recoveryRepo: RecoveryRuntimeRepository,
    auditRepo: DisasterAuditRepository,
    eventBus: AtcEventBus | undefined,
  ) {
    this.recoveryRepo = recoveryRepo
    this.auditRepo = auditRepo
    this.eventBus = eventBus
  }

  async startRecovery(disasterId: string, params: StartRecoveryParams): Promise<AtcRecoveryRuntime> {
    const recovery = await this.recoveryRepo.upsert(disasterId, {
      recoveryPhase: params.recoveryPhase,
      progressPercent: params.progressPercent,
      ...(params.estimatedCompletionAt !== undefined
        ? { estimatedCompletionAt: params.estimatedCompletionAt }
        : {}),
    })
    await this.auditRepo.record(
      disasterId,
      'recovery_runtime',
      'started',
      undefined,
      `phase=${params.recoveryPhase} progress=${params.progressPercent}`,
    )
    this.eventBus?.emit('atc:disaster:recovery:started', {
      disasterId,
      recoveryPhase: recovery.recoveryPhase,
    }).catch(() => undefined)
    return recovery
  }

  async updateProgress(disasterId: string, progressPercent: number): Promise<AtcRecoveryRuntime> {
    const recovery = await this.recoveryRepo.updateProgress(disasterId, progressPercent)
    this.eventBus?.emit('atc:disaster:recovery:progress', {
      disasterId,
      progressPercent: recovery.progressPercent,
    }).catch(() => undefined)
    return recovery
  }
}
