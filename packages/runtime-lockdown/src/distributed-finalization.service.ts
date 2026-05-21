import type { FinalizationRuntimeRepository, AtcFinalizationRuntime, AtcFinalizationType } from './finalization-runtime.repository.js'
import type { LockdownAuditRepository } from './lockdown-audit.repository.js'
import type { RuntimeLockdownEventBus } from './lockdown-recovery.service.js'

export interface StartFinalizationParams {
  finalizationType: AtcFinalizationType
  ownerServerId: string
  finalizationNonce: string
  finalizationData?: Record<string, unknown> | undefined
}

export class DistributedFinalizationService {
  constructor(
    private repo: FinalizationRuntimeRepository,
    private auditRepo: LockdownAuditRepository,
    private eventBus: RuntimeLockdownEventBus,
  ) {}

  async startFinalization(params: StartFinalizationParams): Promise<AtcFinalizationRuntime> {
    const record = await this.repo.create({
      finalizationType: params.finalizationType,
      ownerServerId: params.ownerServerId,
      finalizationNonce: params.finalizationNonce,
      finalizationData: params.finalizationData,
    })
    await this.auditRepo.append({
      eventType: 'finalization_started',
      ownerServerId: record.ownerServerId,
      auditData: { finalizationId: record.finalizationId, finalizationType: record.finalizationType },
    })
    this.eventBus.emit('atc:lockdown:finalization:started', { finalizationId: record.finalizationId }).catch(() => undefined)
    return record
  }

  async beginCommitting(id: string): Promise<AtcFinalizationRuntime> {
    const record = await this.repo.updateStatus(id, 'committing')
    await this.auditRepo.append({
      eventType: 'finalization_committing',
      ownerServerId: record.ownerServerId,
      auditData: { finalizationId: record.finalizationId },
    })
    this.eventBus.emit('atc:lockdown:finalization:committing', { finalizationId: record.finalizationId }).catch(() => undefined)
    return record
  }

  async commitFinalization(id: string): Promise<AtcFinalizationRuntime> {
    const record = await this.repo.updateStatus(id, 'committed', new Date())
    await this.auditRepo.append({
      eventType: 'finalization_committed',
      ownerServerId: record.ownerServerId,
      auditData: { finalizationId: record.finalizationId },
    })
    this.eventBus.emit('atc:lockdown:finalization:committed', { finalizationId: record.finalizationId }).catch(() => undefined)
    return record
  }

  async beginRollingBack(id: string): Promise<AtcFinalizationRuntime> {
    const record = await this.repo.updateStatus(id, 'rolling_back')
    await this.auditRepo.append({
      eventType: 'finalization_rolling_back',
      ownerServerId: record.ownerServerId,
      auditData: { finalizationId: record.finalizationId },
    })
    this.eventBus.emit('atc:lockdown:finalization:rolling_back', { finalizationId: record.finalizationId }).catch(() => undefined)
    return record
  }

  async rollbackFinalization(id: string): Promise<AtcFinalizationRuntime> {
    const record = await this.repo.updateStatus(id, 'rolled_back')
    await this.auditRepo.append({
      eventType: 'finalization_rolled_back',
      ownerServerId: record.ownerServerId,
      auditData: { finalizationId: record.finalizationId },
    })
    this.eventBus.emit('atc:lockdown:finalization:rolled_back', { finalizationId: record.finalizationId }).catch(() => undefined)
    return record
  }

  async getFinalization(id: string): Promise<AtcFinalizationRuntime | null> {
    return this.repo.findById(id)
  }
}
