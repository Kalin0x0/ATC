import type { WorldReconciliationRepository, AtcWorldReconciliation, AtcReconciliationType } from './world-reconciliation.repository.js'
import type { IntegrityAuditRepository } from './integrity-audit.repository.js'
import type { WorldIntegrityEventBus } from './integrity-recovery.service.js'

export interface StartReconciliationServiceParams {
  reconciliationType: AtcReconciliationType
  ownerServerId: string
  reconciliationNonce: string
  reconciliationData?: Record<string, unknown> | undefined
}

export class RuntimeIntegrityCoordinator {
  constructor(
    private reconciliationRepo: WorldReconciliationRepository,
    private auditRepo: IntegrityAuditRepository,
    private eventBus: WorldIntegrityEventBus,
  ) {}

  async startReconciliation(params: StartReconciliationServiceParams): Promise<AtcWorldReconciliation> {
    const record = await this.reconciliationRepo.create({
      reconciliationType: params.reconciliationType,
      ownerServerId: params.ownerServerId,
      reconciliationNonce: params.reconciliationNonce,
      reconciliationData: params.reconciliationData,
    })
    await this.auditRepo.append({
      eventType: 'reconciliation_started',
      integrityId: record.reconciliationId,
      ownerServerId: record.ownerServerId,
      auditData: { reconciliationType: record.reconciliationType },
    })
    this.eventBus.emit('atc:world-integrity:reconciliation:started', { reconciliationId: record.reconciliationId }).catch(() => undefined)
    return record
  }

  async completeReconciliation(id: string): Promise<AtcWorldReconciliation> {
    const record = await this.reconciliationRepo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({
      eventType: 'reconciliation_completed',
      integrityId: record.reconciliationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:world-integrity:reconciliation:completed', { reconciliationId: record.reconciliationId }).catch(() => undefined)
    return record
  }

  async failReconciliation(id: string): Promise<AtcWorldReconciliation> {
    const record = await this.reconciliationRepo.updateStatus(id, 'failed')
    await this.auditRepo.append({
      eventType: 'reconciliation_failed',
      integrityId: record.reconciliationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:world-integrity:reconciliation:failed', { reconciliationId: record.reconciliationId }).catch(() => undefined)
    return record
  }

  async getReconciliation(id: string): Promise<AtcWorldReconciliation | null> {
    return this.reconciliationRepo.findById(id)
  }
}
