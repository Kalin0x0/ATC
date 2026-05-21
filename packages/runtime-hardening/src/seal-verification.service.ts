import type { SealValidationRepository, AtcSealValidation, AtcSealValidationType } from './seal-validation.repository.js'
import type { HardeningAuditRepository } from './hardening-audit.repository.js'
import type { RuntimeHardeningEventBus } from './runtime-hardening.service.js'

export interface CreateSealValidationServiceParams {
  sealType: AtcSealValidationType
  ownerServerId: string
  sealValidationNonce: string
  resourceId: string
  sealData?: Record<string, unknown> | undefined
}

export class RuntimeSealVerificationService {
  constructor(
    private readonly repo: SealValidationRepository,
    private readonly audit: HardeningAuditRepository,
    private readonly bus: RuntimeHardeningEventBus
  ) {}

  async createSealValidation(params: CreateSealValidationServiceParams): Promise<AtcSealValidation> {
    const record = await this.repo.create({
      sealType: params.sealType,
      ownerServerId: params.ownerServerId,
      sealValidationNonce: params.sealValidationNonce,
      resourceId: params.resourceId,
      sealData: params.sealData,
    })
    await this.audit.append(record.sealValidationId, 'seal_validation.created', {
      sealType: record.sealType,
      ownerServerId: record.ownerServerId,
      resourceId: record.resourceId,
    })
    this.bus.emit('seal_validation.created', { sealValidationId: record.sealValidationId }).catch(() => undefined)
    return record
  }

  async beginVerification(id: string): Promise<AtcSealValidation> {
    const record = await this.repo.updateStatus(id, 'verifying')
    await this.audit.append(record.sealValidationId, 'seal_validation.verifying', {
      sealValidationId: record.sealValidationId,
    })
    this.bus.emit('seal_validation.verifying', { sealValidationId: record.sealValidationId }).catch(() => undefined)
    return record
  }

  async verifyRuntimeSeal(id: string): Promise<AtcSealValidation> {
    const record = await this.repo.updateStatus(id, 'verified', new Date())
    await this.audit.append(record.sealValidationId, 'runtime_seal_verified', {
      sealValidationId: record.sealValidationId,
    })
    this.bus.emit('runtime_seal_verified', { sealValidationId: record.sealValidationId }).catch(() => undefined)
    return record
  }

  async breakSealValidation(id: string): Promise<AtcSealValidation> {
    const record = await this.repo.updateStatus(id, 'broken')
    await this.audit.append(record.sealValidationId, 'seal_validation.broken', {
      sealValidationId: record.sealValidationId,
    })
    this.bus.emit('seal_validation.broken', { sealValidationId: record.sealValidationId }).catch(() => undefined)
    return record
  }

  async getSealValidation(id: string): Promise<AtcSealValidation | null> {
    return this.repo.findById(id)
  }
}
