import type { VerificationRuntimeRepository, AtcVerificationRuntime, CreateVerificationParams } from './verification-runtime.repository.js'
import type { CertificationAuditRepository } from './certification-audit.repository.js'
import type { RuntimeCertificationEventBus } from './certification-recovery.service.js'

export class RuntimeVerificationService {
  constructor(
    private repo: VerificationRuntimeRepository,
    private auditRepo: CertificationAuditRepository,
    private eventBus: RuntimeCertificationEventBus,
  ) {}

  async createVerification(params: CreateVerificationParams): Promise<AtcVerificationRuntime> {
    const record = await this.repo.create(params)
    await this.auditRepo.append({
      eventType: 'verification_created',
      certificationId: record.verificationId,
      ownerServerId: record.ownerServerId,
      auditData: { verificationType: record.verificationType },
    })
    this.eventBus.emit('atc:certification:verification:created', { verificationId: record.verificationId }).catch(() => undefined)
    return record
  }

  async beginVerifying(id: string): Promise<AtcVerificationRuntime> {
    const record = await this.repo.updateStatus(id, 'verifying')
    await this.auditRepo.append({
      eventType: 'verification_verifying',
      certificationId: record.verificationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:certification:verification:verifying', { verificationId: record.verificationId }).catch(() => undefined)
    return record
  }

  async passVerification(id: string): Promise<AtcVerificationRuntime> {
    const record = await this.repo.updateStatus(id, 'verified', new Date())
    await this.auditRepo.append({
      eventType: 'verification_verified',
      certificationId: record.verificationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:certification:verification:verified', { verificationId: record.verificationId }).catch(() => undefined)
    return record
  }

  async failVerification(id: string): Promise<AtcVerificationRuntime> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.auditRepo.append({
      eventType: 'verification_failed',
      certificationId: record.verificationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:certification:verification:failed', { verificationId: record.verificationId }).catch(() => undefined)
    return record
  }

  async getVerification(id: string): Promise<AtcVerificationRuntime | null> {
    return this.repo.findById(id)
  }
}
