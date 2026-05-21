import type { RuntimeComplianceRepository, AtcRuntimeCompliance, CreateComplianceParams } from './runtime-compliance.repository.js'
import type { CertificationAuditRepository } from './certification-audit.repository.js'
import type { RuntimeCertificationEventBus } from './certification-recovery.service.js'

export class ComplianceEnforcementService {
  constructor(
    private repo: RuntimeComplianceRepository,
    private auditRepo: CertificationAuditRepository,
    private eventBus: RuntimeCertificationEventBus,
  ) {}

  async createCompliance(params: CreateComplianceParams): Promise<AtcRuntimeCompliance> {
    const record = await this.repo.create(params)
    await this.auditRepo.append({
      eventType: 'compliance_created',
      certificationId: record.complianceId,
      ownerServerId: record.ownerServerId,
      auditData: { complianceType: record.complianceType },
    })
    this.eventBus.emit('atc:certification:compliance:created', { complianceId: record.complianceId }).catch(() => undefined)
    return record
  }

  async enforceCompliance(id: string): Promise<AtcRuntimeCompliance> {
    const record = await this.repo.updateStatus(id, 'enforced', new Date())
    await this.auditRepo.append({
      eventType: 'compliance_enforced',
      certificationId: record.complianceId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:certification:compliance:enforced', { complianceId: record.complianceId }).catch(() => undefined)
    return record
  }

  async violateCompliance(id: string): Promise<AtcRuntimeCompliance> {
    const record = await this.repo.updateStatus(id, 'violated')
    await this.auditRepo.append({
      eventType: 'compliance_violated',
      certificationId: record.complianceId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:certification:compliance:violated', { complianceId: record.complianceId }).catch(() => undefined)
    return record
  }

  async expireCompliance(id: string): Promise<AtcRuntimeCompliance> {
    const record = await this.repo.updateStatus(id, 'expired')
    await this.auditRepo.append({
      eventType: 'compliance_expired',
      certificationId: record.complianceId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:certification:compliance:expired', { complianceId: record.complianceId }).catch(() => undefined)
    return record
  }

  async getCompliance(id: string): Promise<AtcRuntimeCompliance | null> {
    return this.repo.findById(id)
  }
}
