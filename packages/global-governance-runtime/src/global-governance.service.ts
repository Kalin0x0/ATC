import type { GlobalGovernanceRepository, AtcGlobalGovernance, AtcGovernanceDirectiveType } from './global-governance.repository.js'
import type { GovernanceContinuityAuditRepository } from './governance-continuity-audit.repository.js'
import type { GlobalGovernanceEventBus } from './governance-continuity.service.js'

export interface CreateDirectiveParams {
  directiveType: AtcGovernanceDirectiveType
  ownerServerId: string
  directiveNonce: string
  directiveData?: Record<string, unknown> | undefined
}

export class GlobalGovernanceService {
  constructor(
    private repo: GlobalGovernanceRepository,
    private audit: GovernanceContinuityAuditRepository,
    private eventBus: GlobalGovernanceEventBus,
  ) {}

  async createDirective(params: CreateDirectiveParams): Promise<AtcGlobalGovernance> {
    const record = await this.repo.create({
      directiveType: params.directiveType,
      ownerServerId: params.ownerServerId,
      directiveNonce: params.directiveNonce,
      directiveData: params.directiveData,
    })
    await this.audit.append({
      eventType: 'directive_created',
      directiveId: record.directiveId,
      ownerServerId: record.ownerServerId,
      auditData: { directiveType: record.directiveType },
    })
    this.eventBus.emit('atc:global-governance:directive:created', { directiveId: record.directiveId }).catch(() => undefined)
    return record
  }

  async activateDirective(id: string): Promise<AtcGlobalGovernance> {
    const record = await this.repo.updateStatus(id, 'active')
    await this.audit.append({
      eventType: 'directive_activated',
      directiveId: record.directiveId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:global-governance:directive:activated', { directiveId: record.directiveId }).catch(() => undefined)
    return record
  }

  async resolveDirective(id: string): Promise<AtcGlobalGovernance> {
    const record = await this.repo.updateStatus(id, 'resolved', new Date())
    await this.audit.append({
      eventType: 'directive_resolved',
      directiveId: record.directiveId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:global-governance:directive:resolved', { directiveId: record.directiveId }).catch(() => undefined)
    return record
  }

  async failDirective(id: string): Promise<AtcGlobalGovernance> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.audit.append({
      eventType: 'directive_failed',
      directiveId: record.directiveId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:global-governance:directive:failed', { directiveId: record.directiveId }).catch(() => undefined)
    return record
  }

  async getDirective(id: string): Promise<AtcGlobalGovernance | null> {
    return this.repo.findById(id)
  }
}
