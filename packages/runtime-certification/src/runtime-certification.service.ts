import type { RuntimeCertificationRepository, AtcRuntimeCertification, CreateCertificationParams } from './runtime-certification.repository.js'
import type { CertificationAuditRepository } from './certification-audit.repository.js'
import type { RuntimeCertificationEventBus } from './certification-recovery.service.js'

export class RuntimeCertificationService {
  constructor(
    private repo: RuntimeCertificationRepository,
    private auditRepo: CertificationAuditRepository,
    private eventBus: RuntimeCertificationEventBus,
  ) {}

  async createCertification(params: CreateCertificationParams): Promise<AtcRuntimeCertification> {
    const record = await this.repo.create(params)
    await this.auditRepo.append({
      eventType: 'certification_created',
      certificationId: record.certificationId,
      ownerServerId: record.ownerServerId,
      auditData: { certificationType: record.certificationType },
    })
    this.eventBus.emit('atc:certification:certification:created', { certificationId: record.certificationId }).catch(() => undefined)
    return record
  }

  async certify(id: string): Promise<AtcRuntimeCertification> {
    const record = await this.repo.updateStatus(id, 'certified', new Date())
    await this.auditRepo.append({
      eventType: 'certification_certified',
      certificationId: record.certificationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:certification:certification:certified', { certificationId: record.certificationId }).catch(() => undefined)
    return record
  }

  async revokeCertification(id: string): Promise<AtcRuntimeCertification> {
    const record = await this.repo.updateStatus(id, 'revoked')
    await this.auditRepo.append({
      eventType: 'certification_revoked',
      certificationId: record.certificationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:certification:certification:revoked', { certificationId: record.certificationId }).catch(() => undefined)
    return record
  }

  async expireCertification(id: string): Promise<AtcRuntimeCertification> {
    const record = await this.repo.updateStatus(id, 'expired')
    await this.auditRepo.append({
      eventType: 'certification_expired',
      certificationId: record.certificationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:certification:certification:expired', { certificationId: record.certificationId }).catch(() => undefined)
    return record
  }

  async failCertification(id: string): Promise<AtcRuntimeCertification> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.auditRepo.append({
      eventType: 'certification_failed',
      certificationId: record.certificationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:certification:certification:failed', { certificationId: record.certificationId }).catch(() => undefined)
    return record
  }

  async getCertification(id: string): Promise<AtcRuntimeCertification | null> {
    return this.repo.findById(id)
  }
}
