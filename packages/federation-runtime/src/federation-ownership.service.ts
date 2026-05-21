import type { FederationOwnershipRepository, AtcFederationOwnership, ClaimOwnershipParams } from './federation-ownership.repository.js'
import type { FederationAuditRepository } from './federation-audit.repository.js'
import type { FederationRuntimeEventBus } from './federation-recovery.service.js'

export class FederationOwnershipService {
  constructor(
    private ownershipRepo: FederationOwnershipRepository,
    private auditRepo: FederationAuditRepository,
    private eventBus: FederationRuntimeEventBus,
  ) {}

  async claimOwnership(params: ClaimOwnershipParams): Promise<AtcFederationOwnership> {
    const ownership = await this.ownershipRepo.upsert(params)
    await this.auditRepo.append({ entityId: ownership.entityId, eventType: 'ownership_claimed', auditData: { ownerClusterId: ownership.ownerClusterId } })
    this.eventBus.emit('atc:federation:ownership:claimed', { entityId: ownership.entityId, ownerClusterId: ownership.ownerClusterId }).catch(() => undefined)
    return ownership
  }

  async transferOwnership(entityId: string, newClusterId: string): Promise<AtcFederationOwnership> {
    const ownership = await this.ownershipRepo.transfer(entityId, newClusterId)
    await this.auditRepo.append({ entityId: ownership.entityId, eventType: 'ownership_transferred', auditData: { newClusterId } })
    this.eventBus.emit('atc:federation:ownership:transferred', { entityId: ownership.entityId, newClusterId }).catch(() => undefined)
    return ownership
  }

  async releaseOwnership(entityId: string): Promise<void> {
    await this.ownershipRepo.release(entityId)
    await this.auditRepo.append({ entityId, eventType: 'ownership_released' })
    this.eventBus.emit('atc:federation:ownership:released', { entityId }).catch(() => undefined)
  }

  async getOwnership(entityId: string): Promise<AtcFederationOwnership | null> {
    return this.ownershipRepo.findByEntity(entityId)
  }
}
