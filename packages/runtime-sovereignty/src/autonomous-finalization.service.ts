import type {
  AutonomousFinalizationRepository,
  AtcAutonomousFinalization,
  CreateAutonomousFinalizationParams,
} from './autonomous-finalization.repository.js'
import type { SovereigntyAuditRepository } from './sovereignty-audit.repository.js'
import type { SovereigntyRuntimeEventBus } from './sovereignty-recovery.service.js'

export class AutonomousFinalizationService {
  constructor(
    private repo: AutonomousFinalizationRepository,
    private auditRepo: SovereigntyAuditRepository,
    private eventBus: SovereigntyRuntimeEventBus,
  ) {}

  async initiateFinalization(params: CreateAutonomousFinalizationParams): Promise<AtcAutonomousFinalization> {
    const record = await this.repo.create(params)
    await this.auditRepo.append({
      eventType: 'finalization_initiated',
      sovereigntyId: record.finalizationId,
      ownerServerId: record.ownerServerId,
      auditData: { finalizationType: record.finalizationType },
    })
    this.eventBus.emit('atc:runtime-sovereignty:finalization:initiated', { finalizationId: record.finalizationId }).catch(() => undefined)
    return record
  }

  async processFinalization(id: string): Promise<AtcAutonomousFinalization> {
    const record = await this.repo.updateStatus(id, 'processing')
    await this.auditRepo.append({
      eventType: 'finalization_processing',
      sovereigntyId: record.finalizationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:finalization:processing', { finalizationId: record.finalizationId }).catch(() => undefined)
    return record
  }

  async completeFinalization(id: string): Promise<AtcAutonomousFinalization> {
    const record = await this.repo.updateStatus(id, 'finalized', new Date())
    await this.auditRepo.append({
      eventType: 'finalization_completed',
      sovereigntyId: record.finalizationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:finalization:completed', { finalizationId: record.finalizationId }).catch(() => undefined)
    return record
  }

  async abortFinalization(id: string): Promise<AtcAutonomousFinalization> {
    const record = await this.repo.updateStatus(id, 'aborted')
    await this.auditRepo.append({
      eventType: 'finalization_aborted',
      sovereigntyId: record.finalizationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:finalization:aborted', { finalizationId: record.finalizationId }).catch(() => undefined)
    return record
  }

  async failFinalization(id: string): Promise<AtcAutonomousFinalization> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.auditRepo.append({
      eventType: 'finalization_failed',
      sovereigntyId: record.finalizationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:finalization:failed', { finalizationId: record.finalizationId }).catch(() => undefined)
    return record
  }

  async getFinalization(id: string): Promise<AtcAutonomousFinalization | null> {
    return this.repo.findById(id)
  }
}
