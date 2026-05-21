import type {
  DeterministicAuditRepository,
  AtcDeterministicAudit,
  CreateDeterministicAuditParams,
} from './deterministic-audit.repository.js'
import type { EnterpriseAuditRepository } from './enterprise-audit.repository.js'
import type { EnterpriseReadinessEventBus } from './enterprise-readiness.service.js'

export class DeterministicAuditService {
  constructor(
    private readonly repo: DeterministicAuditRepository,
    private readonly audit: EnterpriseAuditRepository,
    private readonly bus: EnterpriseReadinessEventBus
  ) {}

  async createAudit(params: CreateDeterministicAuditParams): Promise<AtcDeterministicAudit> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'deterministic_audit.created', { auditId: record.auditId })
    this.bus.emit('enterprise_audit_started', { auditId: record.auditId }).catch(() => undefined)
    return record
  }

  async beginAuditing(id: string): Promise<AtcDeterministicAudit> {
    const record = await this.repo.updateStatus(id, 'auditing')
    this.bus.emit('deterministic_audit.auditing', { auditId: record.auditId }).catch(() => undefined)
    return record
  }

  async completeAudit(id: string): Promise<AtcDeterministicAudit> {
    const record = await this.repo.updateStatus(id, 'completed', new Date())
    await this.audit.append(record.id, 'deterministic_audit.completed', { auditId: record.auditId })
    this.bus.emit('deterministic_audit.completed', { auditId: record.auditId }).catch(() => undefined)
    return record
  }

  async archiveAudit(id: string): Promise<AtcDeterministicAudit> {
    const record = await this.repo.updateStatus(id, 'archived')
    this.bus.emit('deterministic_audit.archived', { auditId: record.auditId }).catch(() => undefined)
    return record
  }

  async getAudit(id: string): Promise<AtcDeterministicAudit | null> {
    return this.repo.findById(id)
  }
}
