import type { SpatialOwnershipRepository } from './spatial-ownership.repository.js'
import type {
  AtcSpatialOwnership,
  ClaimOwnershipParams,
} from './spatial-ownership.repository.js'
import type { ReplicationAuditRepository } from './replication-audit.repository.js'

export interface ReplicationEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export class SpatialOwnershipService {
  constructor(
    private readonly ownershipRepo: SpatialOwnershipRepository,
    private readonly auditRepo: ReplicationAuditRepository,
    private readonly eventBus?: ReplicationEventBus | undefined
  ) {}

  async claimOwnership(params: ClaimOwnershipParams): Promise<AtcSpatialOwnership> {
    const ownership = await this.ownershipRepo.claim(params)
    await this.auditRepo.record(params.entityId, 'ownership.claimed', params.ownerServerId, {
      entityType: params.entityType,
      regionId: params.regionId ?? null,
    })
    this.eventBus
      ?.emit('atc:replication:ownership:claimed', {
        entityId: params.entityId,
        entityType: params.entityType,
        ownerServerId: params.ownerServerId,
        regionId: params.regionId ?? null,
      })
      .catch(() => undefined)
    return ownership
  }

  async transferOwnership(
    entityId: string,
    fromServerId: string,
    toServerId: string
  ): Promise<AtcSpatialOwnership> {
    const ownership = await this.ownershipRepo.transfer(entityId, fromServerId, toServerId)
    await this.auditRepo.record(entityId, 'ownership.transferred', toServerId, {
      fromServerId,
      toServerId,
    })
    this.eventBus
      ?.emit('atc:replication:ownership:transferred', {
        entityId,
        fromServerId,
        toServerId,
      })
      .catch(() => undefined)
    return ownership
  }

  async getOwnership(entityId: string): Promise<AtcSpatialOwnership | null> {
    return this.ownershipRepo.findByEntityId(entityId)
  }

  async releaseOwnership(entityId: string): Promise<void> {
    await this.ownershipRepo.deleteByEntityId(entityId)
    await this.auditRepo.record(entityId, 'ownership.released')
  }

  async cleanupStaleOwnership(thresholdMs: number): Promise<number> {
    const stale = await this.ownershipRepo.listStale(thresholdMs)
    let count = 0
    for (const ownership of stale) {
      await this.ownershipRepo.deleteByEntityId(ownership.entityId)
      await this.auditRepo.record(ownership.entityId, 'ownership.cleanup.stale', undefined, {
        ownerServerId: ownership.ownerServerId,
      })
      count++
    }
    this.eventBus
      ?.emit('atc:replication:ownership:cleanup', { count, thresholdMs })
      .catch(() => undefined)
    return count
  }
}
