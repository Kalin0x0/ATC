import type { GlobalPolicyRepository, AtcGlobalPolicy, AtcPolicyType } from './global-policy.repository.js'
import type { GovernanceContinuityAuditRepository } from './governance-continuity-audit.repository.js'
import type { GlobalGovernanceEventBus } from './governance-continuity.service.js'

export interface UpsertPolicyServiceParams {
  policyId: string
  policyType: AtcPolicyType
  ownerServerId: string
  policyData?: Record<string, unknown> | undefined
}

export class DistributedPolicyCoordinator {
  constructor(
    private repo: GlobalPolicyRepository,
    private audit: GovernanceContinuityAuditRepository,
    private eventBus: GlobalGovernanceEventBus,
  ) {}

  async upsertPolicy(params: UpsertPolicyServiceParams): Promise<AtcGlobalPolicy> {
    const record = await this.repo.upsert({
      policyId: params.policyId,
      policyType: params.policyType,
      ownerServerId: params.ownerServerId,
      policyData: params.policyData,
    })
    await this.audit.append({
      eventType: 'policy_upserted',
      directiveId: record.policyId,
      ownerServerId: record.ownerServerId,
      auditData: { policyType: record.policyType },
    })
    this.eventBus.emit('atc:global-governance:policy:upserted', { policyId: record.policyId }).catch(() => undefined)
    return record
  }

  async suspendPolicy(id: string): Promise<AtcGlobalPolicy> {
    const record = await this.repo.updateStatus(id, 'suspended')
    await this.audit.append({
      eventType: 'policy_suspended',
      directiveId: record.policyId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:global-governance:policy:suspended', { policyId: record.policyId }).catch(() => undefined)
    return record
  }

  async revokePolicy(id: string): Promise<AtcGlobalPolicy> {
    const record = await this.repo.updateStatus(id, 'revoked')
    await this.audit.append({
      eventType: 'policy_revoked',
      directiveId: record.policyId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:global-governance:policy:revoked', { policyId: record.policyId }).catch(() => undefined)
    return record
  }

  async getPolicy(policyId: string): Promise<AtcGlobalPolicy | null> {
    return this.repo.findByPolicyId(policyId)
  }
}
