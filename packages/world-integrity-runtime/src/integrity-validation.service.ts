import type { IntegrityValidationRepository, AtcIntegrityValidation, AtcValidationType } from './integrity-validation.repository.js'
import type { IntegrityAuditRepository } from './integrity-audit.repository.js'
import type { WorldIntegrityEventBus } from './integrity-recovery.service.js'

export interface StartValidationServiceParams {
  validationType: AtcValidationType
  ownerServerId: string
  targetId?: string | undefined
  validationNonce: string
  validationData?: Record<string, unknown> | undefined
}

export class GlobalWorldValidationService {
  constructor(
    private validationRepo: IntegrityValidationRepository,
    private auditRepo: IntegrityAuditRepository,
    private eventBus: WorldIntegrityEventBus,
  ) {}

  async startValidation(params: StartValidationServiceParams): Promise<AtcIntegrityValidation> {
    const record = await this.validationRepo.create({
      validationType: params.validationType,
      ownerServerId: params.ownerServerId,
      targetId: params.targetId,
      validationNonce: params.validationNonce,
      validationData: params.validationData,
    })
    await this.auditRepo.append({
      eventType: 'validation_started',
      integrityId: record.validationId,
      ownerServerId: record.ownerServerId,
      auditData: { validationType: record.validationType, targetId: record.targetId },
    })
    this.eventBus.emit('atc:world-integrity:validation:started', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async passValidation(id: string): Promise<AtcIntegrityValidation> {
    const record = await this.validationRepo.updateStatus(id, 'passed', new Date())
    await this.auditRepo.append({
      eventType: 'validation_passed',
      integrityId: record.validationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:world-integrity:validation:passed', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async failValidation(id: string): Promise<AtcIntegrityValidation> {
    const record = await this.validationRepo.updateStatus(id, 'failed', new Date())
    await this.auditRepo.append({
      eventType: 'validation_failed',
      integrityId: record.validationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:world-integrity:validation:failed', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async getValidation(id: string): Promise<AtcIntegrityValidation | null> {
    return this.validationRepo.findById(id)
  }
}
