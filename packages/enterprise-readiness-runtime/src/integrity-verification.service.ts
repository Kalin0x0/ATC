import type {
  IntegrityVerificationRepository,
  AtcIntegrityVerification,
  CreateIntegrityVerificationParams,
} from './integrity-verification.repository.js'
import type { EnterpriseAuditRepository } from './enterprise-audit.repository.js'
import type { EnterpriseReadinessEventBus } from './enterprise-readiness.service.js'

export class RuntimeIntegrityVerificationService {
  constructor(
    private readonly repo: IntegrityVerificationRepository,
    private readonly audit: EnterpriseAuditRepository,
    private readonly bus: EnterpriseReadinessEventBus
  ) {}

  async createVerification(params: CreateIntegrityVerificationParams): Promise<AtcIntegrityVerification> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'integrity_verification.created', { verificationId: record.verificationId })
    this.bus.emit('integrity_verification.created', { verificationId: record.verificationId }).catch(() => undefined)
    return record
  }

  async beginVerification(id: string): Promise<AtcIntegrityVerification> {
    const record = await this.repo.updateStatus(id, 'verifying')
    this.bus.emit('integrity_verification.verifying', { verificationId: record.verificationId }).catch(() => undefined)
    return record
  }

  async verifyIntegrity(id: string): Promise<AtcIntegrityVerification> {
    const record = await this.repo.updateStatus(id, 'verified', new Date())
    await this.audit.append(record.id, 'runtime_integrity_verified', { verificationId: record.verificationId })
    this.bus.emit('runtime_integrity_verified', { verificationId: record.verificationId }).catch(() => undefined)
    return record
  }

  async failVerification(id: string): Promise<AtcIntegrityVerification> {
    const record = await this.repo.updateStatus(id, 'failed')
    this.bus.emit('integrity_verification.failed', { verificationId: record.verificationId }).catch(() => undefined)
    return record
  }

  async getVerification(id: string): Promise<AtcIntegrityVerification | null> {
    return this.repo.findById(id)
  }
}
