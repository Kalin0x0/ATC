import type { GlobalOwnershipRepository, AtcGlobalOwnership, AtcOwnershipType } from './global-ownership.repository.js'
import type { GovernanceContinuityAuditRepository } from './governance-continuity-audit.repository.js'
import type { GlobalGovernanceEventBus } from './governance-continuity.service.js'

export interface ClaimOwnershipParams {
  resourceId: string
  ownershipType: AtcOwnershipType
  ownerServerId: string
  ownershipData?: Record<string, unknown> | undefined
}

export class GlobalOwnershipAuthority {
  constructor(
    private repo: GlobalOwnershipRepository,
    private audit: GovernanceContinuityAuditRepository,
    private eventBus: GlobalGovernanceEventBus,
  ) {}

  async claimOwnership(params: ClaimOwnershipParams): Promise<AtcGlobalOwnership> {
    const record = await this.repo.upsert({
      resourceId: params.resourceId,
      ownershipType: params.ownershipType,
      ownerServerId: params.ownerServerId,
      ownershipData: params.ownershipData,
    })
    await this.audit.append({
      eventType: 'ownership_claimed',
      directiveId: record.resourceId,
      ownerServerId: record.ownerServerId,
      auditData: { ownershipType: record.ownershipType },
    })
    this.eventBus.emit('atc:global-governance:ownership:claimed', { resourceId: record.resourceId }).catch(() => undefined)
    return record
  }

  async transferOwnership(resourceId: string, newOwnerServerId: string): Promise<AtcGlobalOwnership> {
    const record = await this.repo.transfer(resourceId, newOwnerServerId)
    await this.audit.append({
      eventType: 'ownership_transferred',
      directiveId: record.resourceId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:global-governance:ownership:transferred', { resourceId: record.resourceId }).catch(() => undefined)
    return record
  }

  async releaseOwnership(resourceId: string): Promise<AtcGlobalOwnership> {
    const record = await this.repo.release(resourceId)
    await this.audit.append({
      eventType: 'ownership_released',
      directiveId: record.resourceId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:global-governance:ownership:released', { resourceId: record.resourceId }).catch(() => undefined)
    return record
  }

  async getOwnership(resourceId: string): Promise<AtcGlobalOwnership | null> {
    return this.repo.findByResourceId(resourceId)
  }
}
