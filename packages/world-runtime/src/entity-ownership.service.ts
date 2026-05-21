import type { AtcEntityOwnership } from '@atc/shared-types'
import { ATC_WORLD_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { EntityOwnershipRepository } from './entity-ownership.repository.js'
import type { WorldEntityRepository } from './world-entity.repository.js'
import type { WorldPool } from './pool.js'

export interface EntityOwnershipDeps {
  ownershipRepo: EntityOwnershipRepository
  entityRepo: WorldEntityRepository
  pool: WorldPool
  eventBus: AtcEventBus | undefined
}

export interface AcquireOwnershipServiceParams {
  entityId: string
  principalId: string
  sceneId?: string | undefined
}

export class EntityOwnershipService {
  private readonly ownershipRepo: EntityOwnershipRepository
  private readonly entityRepo: WorldEntityRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: EntityOwnershipDeps) {
    this.ownershipRepo = deps.ownershipRepo
    this.entityRepo    = deps.entityRepo
    this.eventBus      = deps.eventBus
  }

  async acquireOwnership(params: AcquireOwnershipServiceParams): Promise<AtcEntityOwnership> {
    const ownership = await this.ownershipRepo.acquire({
      entityId:    params.entityId,
      principalId: params.principalId,
      sceneId:     params.sceneId,
    })

    this.eventBus?.emit(ATC_WORLD_EVENTS.OWNERSHIP_ACQUIRED, {
      entityId:    ownership.entityId,
      principalId: ownership.principalId,
      sceneId:     ownership.sceneId,
    }).catch(() => undefined)

    return ownership
  }

  async releaseOwnership(
    entityId: string,
    principalId: string,
  ): Promise<AtcEntityOwnership | null> {
    try {
      const ownership = await this.ownershipRepo.release(entityId, principalId)

      this.eventBus?.emit(ATC_WORLD_EVENTS.OWNERSHIP_RELEASED, {
        entityId:    ownership.entityId,
        principalId: ownership.principalId,
      }).catch(() => undefined)

      return ownership
    } catch {
      // Not found — do not throw, return null as per spec
      return null
    }
  }

  async getActiveOwner(entityId: string): Promise<AtcEntityOwnership | null> {
    return this.ownershipRepo.findActive(entityId)
  }

  async listOwnedByPrincipal(principalId: string): Promise<AtcEntityOwnership[]> {
    return this.ownershipRepo.listActiveByPrincipal(principalId)
  }
}
