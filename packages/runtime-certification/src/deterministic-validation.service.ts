import type { DeterministicValidationRepository, AtcDeterministicValidation, CreateValidationParams } from './deterministic-validation.repository.js'
import type { CertificationAuditRepository } from './certification-audit.repository.js'
import type { RuntimeCertificationEventBus } from './certification-recovery.service.js'

export class DeterministicValidationService {
  constructor(
    private repo: DeterministicValidationRepository,
    private auditRepo: CertificationAuditRepository,
    private eventBus: RuntimeCertificationEventBus,
  ) {}

  async createValidation(params: CreateValidationParams): Promise<AtcDeterministicValidation> {
    const record = await this.repo.create(params)
    await this.auditRepo.append({
      eventType: 'validation_created',
      certificationId: record.validationId,
      ownerServerId: record.ownerServerId,
      auditData: { validationType: record.validationType },
    })
    this.eventBus.emit('atc:certification:validation:created', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async beginValidating(id: string): Promise<AtcDeterministicValidation> {
    const record = await this.repo.updateStatus(id, 'running')
    await this.auditRepo.append({
      eventType: 'validation_running',
      certificationId: record.validationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:certification:validation:running', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async passValidation(id: string): Promise<AtcDeterministicValidation> {
    const record = await this.repo.updateStatus(id, 'passed', new Date())
    await this.auditRepo.append({
      eventType: 'validation_passed',
      certificationId: record.validationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:certification:validation:passed', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async failValidation(id: string): Promise<AtcDeterministicValidation> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.auditRepo.append({
      eventType: 'validation_failed',
      certificationId: record.validationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:certification:validation:failed', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async skipValidation(id: string): Promise<AtcDeterministicValidation> {
    const record = await this.repo.updateStatus(id, 'skipped')
    await this.auditRepo.append({
      eventType: 'validation_skipped',
      certificationId: record.validationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:certification:validation:skipped', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async getValidation(id: string): Promise<AtcDeterministicValidation | null> {
    return this.repo.findById(id)
  }
}
