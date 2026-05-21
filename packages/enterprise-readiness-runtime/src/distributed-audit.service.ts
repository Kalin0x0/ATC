import type {
  DistributedAuditRepository,
  AtcDistributedAudit,
  RegisterAuditNodeParams,
} from './distributed-audit.repository.js'
import type { EnterpriseAuditRepository } from './enterprise-audit.repository.js'
import type { EnterpriseReadinessEventBus } from './enterprise-readiness.service.js'

export class DistributedAuditOrchestrator {
  constructor(
    private readonly repo: DistributedAuditRepository,
    private readonly audit: EnterpriseAuditRepository,
    private readonly bus: EnterpriseReadinessEventBus
  ) {}

  async registerNode(params: RegisterAuditNodeParams): Promise<AtcDistributedAudit> {
    const record = await this.repo.upsert(params)
    await this.audit.append(record.id, 'audit_node.registered', { auditNodeId: record.auditNodeId })
    this.bus.emit('audit_node.registered', { auditNodeId: record.auditNodeId }).catch(() => undefined)
    return record
  }

  async syncNode(auditNodeId: string): Promise<AtcDistributedAudit> {
    const record = await this.repo.updateStatus(auditNodeId, 'syncing')
    this.bus.emit('audit_node.syncing', { auditNodeId: record.auditNodeId }).catch(() => undefined)
    return record
  }

  async completeSyncNode(auditNodeId: string): Promise<AtcDistributedAudit> {
    const record = await this.repo.updateStatus(auditNodeId, 'synced')
    await this.audit.append(record.id, 'audit_node.synced', { auditNodeId: record.auditNodeId })
    this.bus.emit('audit_node.synced', { auditNodeId: record.auditNodeId }).catch(() => undefined)
    return record
  }

  async degradeNode(auditNodeId: string): Promise<AtcDistributedAudit> {
    const record = await this.repo.updateStatus(auditNodeId, 'degraded')
    this.bus.emit('audit_node.degraded', { auditNodeId: record.auditNodeId }).catch(() => undefined)
    return record
  }

  async getNode(auditNodeId: string): Promise<AtcDistributedAudit | null> {
    return this.repo.findByNodeId(auditNodeId)
  }
}
