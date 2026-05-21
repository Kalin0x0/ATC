import type { SecurityValidationRepository, AtcSecurityValidation, AtcSecurityValidationType } from './security-validation.repository.js'
import type { HardeningAuditRepository } from './hardening-audit.repository.js'
import type { RuntimeHardeningEventBus } from './runtime-hardening.service.js'

export interface CreateSecurityValidationServiceParams {
  validationType: AtcSecurityValidationType
  ownerServerId: string
  validationNonce: string
  validationData?: Record<string, unknown> | undefined
}

export class DistributedSecurityValidationService {
  constructor(
    private readonly repo: SecurityValidationRepository,
    private readonly audit: HardeningAuditRepository,
    private readonly bus: RuntimeHardeningEventBus
  ) {}

  async createValidation(params: CreateSecurityValidationServiceParams): Promise<AtcSecurityValidation> {
    const record = await this.repo.create({
      validationType: params.validationType,
      ownerServerId: params.ownerServerId,
      validationNonce: params.validationNonce,
      validationData: params.validationData,
    })
    await this.audit.append(record.validationId, 'security_validation.created', {
      validationType: record.validationType,
      ownerServerId: record.ownerServerId,
    })
    this.bus.emit('security_validation.created', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async beginValidating(id: string): Promise<AtcSecurityValidation> {
    const record = await this.repo.updateStatus(id, 'validating')
    await this.audit.append(record.validationId, 'security_validation.validating', {
      validationId: record.validationId,
    })
    this.bus.emit('security_validation.validating', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async passValidation(id: string): Promise<AtcSecurityValidation> {
    const record = await this.repo.updateStatus(id, 'passed', new Date())
    await this.audit.append(record.validationId, 'immutable_hardening_verified', {
      validationId: record.validationId,
    })
    this.bus.emit('immutable_hardening_verified', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async failValidation(id: string): Promise<AtcSecurityValidation> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.audit.append(record.validationId, 'security_validation.failed', {
      validationId: record.validationId,
    })
    this.bus.emit('security_validation.failed', { validationId: record.validationId }).catch(() => undefined)
    return record
  }

  async getValidation(id: string): Promise<AtcSecurityValidation | null> {
    return this.repo.findById(id)
  }
}
