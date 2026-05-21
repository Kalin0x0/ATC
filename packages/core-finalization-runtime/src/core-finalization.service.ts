import type {
  CoreFinalizationRepository,
  AtcCoreFinalization,
  AtcCoreFinalizationType,
} from './core-finalization.repository.js'
import type { CoreFinalizationAuditRepository } from './core-finalization-audit.repository.js'
import type { CoreFinalizationEventBus } from './finalization-recovery.service.js'

export interface CreateCoreFinalizationServiceParams {
  finalizationType: AtcCoreFinalizationType
  ownerServerId: string
  finalizationNonce: string
  finalizationData?: Record<string, unknown> | undefined
}

export class CoreFinalizationService {
  constructor(
    private repo: CoreFinalizationRepository,
    private auditRepo: CoreFinalizationAuditRepository,
    private eventBus: CoreFinalizationEventBus,
  ) {}

  async initiateFinalization(params: CreateCoreFinalizationServiceParams): Promise<AtcCoreFinalization> {
    const record = await this.repo.create({
      finalizationType: params.finalizationType,
      ownerServerId: params.ownerServerId,
      finalizationNonce: params.finalizationNonce,
      finalizationData: params.finalizationData,
    })
    await this.auditRepo.append({
      eventType: 'finalization_initiated',
      finalizationId: record.finalizationId,
      ownerServerId: record.ownerServerId,
      auditData: { finalizationType: record.finalizationType },
    })
    this.eventBus.emit('atc:core-finalization-runtime:finalization:initiated', {
      finalizationId: record.finalizationId,
    }).catch(() => undefined)
    return record
  }

  async activateFinalization(id: string): Promise<AtcCoreFinalization> {
    const record = await this.repo.updateStatus(id, 'active')
    await this.auditRepo.append({
      eventType: 'finalization_activated',
      finalizationId: record.finalizationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:core-finalization-runtime:finalization:activated', {
      finalizationId: record.finalizationId,
    }).catch(() => undefined)
    return record
  }

  async beginCompleting(id: string): Promise<AtcCoreFinalization> {
    const record = await this.repo.updateStatus(id, 'completing')
    await this.auditRepo.append({
      eventType: 'finalization_completing',
      finalizationId: record.finalizationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:core-finalization-runtime:finalization:completing', {
      finalizationId: record.finalizationId,
    }).catch(() => undefined)
    return record
  }

  async completeFinalization(id: string): Promise<AtcCoreFinalization> {
    const record = await this.repo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({
      eventType: 'finalization_completed',
      finalizationId: record.finalizationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:core-finalization-runtime:finalization:completed', {
      finalizationId: record.finalizationId,
    }).catch(() => undefined)
    return record
  }

  async failFinalization(id: string): Promise<AtcCoreFinalization> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.auditRepo.append({
      eventType: 'finalization_failed',
      finalizationId: record.finalizationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:core-finalization-runtime:finalization:failed', {
      finalizationId: record.finalizationId,
    }).catch(() => undefined)
    return record
  }

  async getFinalization(id: string): Promise<AtcCoreFinalization | null> {
    return this.repo.findById(id)
  }
}
