import type { ComplianceCoordinationRepository, AtcComplianceCoordination, UpsertCoordinationParams } from './compliance-coordination.repository.js'
import type { CertificationAuditRepository } from './certification-audit.repository.js'
import type { RuntimeCertificationEventBus } from './certification-recovery.service.js'

export class DistributedComplianceCoordinator {
  constructor(
    private repo: ComplianceCoordinationRepository,
    private auditRepo: CertificationAuditRepository,
    private eventBus: RuntimeCertificationEventBus,
  ) {}

  async upsertCoordination(params: UpsertCoordinationParams): Promise<AtcComplianceCoordination> {
    const record = await this.repo.upsert(params)
    await this.auditRepo.append({
      eventType: 'coordination_upserted',
      certificationId: record.coordinationId,
      ownerServerId: record.ownerServerId,
      auditData: { coordinationType: record.coordinationType },
    })
    this.eventBus.emit('atc:certification:coordination:upserted', { coordinationId: record.coordinationId }).catch(() => undefined)
    return record
  }

  async suspendCoordination(id: string): Promise<AtcComplianceCoordination> {
    const record = await this.repo.updateStatus(id, 'suspended')
    await this.auditRepo.append({
      eventType: 'coordination_suspended',
      certificationId: record.coordinationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:certification:coordination:suspended', { coordinationId: record.coordinationId }).catch(() => undefined)
    return record
  }

  async completeCoordination(id: string): Promise<AtcComplianceCoordination> {
    const record = await this.repo.updateStatus(id, 'completed')
    await this.auditRepo.append({
      eventType: 'coordination_completed',
      certificationId: record.coordinationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:certification:coordination:completed', { coordinationId: record.coordinationId }).catch(() => undefined)
    return record
  }

  async getCoordination(coordinationId: string): Promise<AtcComplianceCoordination | null> {
    return this.repo.findByCoordinationId(coordinationId)
  }
}
