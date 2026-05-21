import type { AtcWorldEntity, AtcWorldEntityStatus, AtcWorldEntityType } from '@atc/shared-types'
import { ATC_WORLD_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { WorldEntityRepository } from './world-entity.repository.js'
import type { SceneRuntimeRepository } from './scene-runtime.repository.js'
import type { WorldPool } from './pool.js'
import { WorldEntityNotFoundError } from './errors.js'

export interface RuntimeReplicationDeps {
  entityRepo: WorldEntityRepository
  sceneRepo: SceneRuntimeRepository
  pool: WorldPool
  eventBus: AtcEventBus | undefined
}

export interface RegisterEntityServiceParams {
  entityType: AtcWorldEntityType
  ownerPrincipalId?: string | null | undefined
  networkId?: number | undefined
  model: string
  x: number
  y: number
  z: number
  heading: number
  spawnNonce: string
  sceneId?: string | null | undefined
}

export interface ReconcileEntityParams {
  x: number
  y: number
  z: number
  heading: number
  networkId?: number | undefined
}

export class RuntimeReplicationService {
  private readonly entityRepo: WorldEntityRepository
  private readonly sceneRepo: SceneRuntimeRepository
  private readonly pool: WorldPool
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: RuntimeReplicationDeps) {
    this.entityRepo = deps.entityRepo
    this.sceneRepo  = deps.sceneRepo
    this.pool       = deps.pool
    this.eventBus   = deps.eventBus
  }

  async registerEntity(params: RegisterEntityServiceParams): Promise<AtcWorldEntity> {
    const entity = await this.entityRepo.register({
      entityType:       params.entityType,
      ownerPrincipalId: params.ownerPrincipalId,
      networkId:        params.networkId,
      model:            params.model,
      x:                params.x,
      y:                params.y,
      z:                params.z,
      heading:          params.heading,
      spawnNonce:       params.spawnNonce,
      sceneId:          params.sceneId,
    })

    // Increment scene entity count if entity belongs to a scene
    if (entity.sceneId) {
      await this.sceneRepo.incrementEntityCount(entity.sceneId).catch(() => undefined)
    }

    this.eventBus?.emit(ATC_WORLD_EVENTS.ENTITY_REGISTERED, {
      entityId:   entity.id,
      entityType: entity.entityType,
      sceneId:    entity.sceneId,
    }).catch(() => undefined)

    return entity
  }

  async despawnEntity(entityId: string): Promise<AtcWorldEntity> {
    const entity = await this.entityRepo.despawn(entityId)

    // Decrement scene entity count if entity belongs to a scene
    if (entity.sceneId) {
      await this.sceneRepo.decrementEntityCount(entity.sceneId).catch(() => undefined)
    }

    this.eventBus?.emit(ATC_WORLD_EVENTS.ENTITY_DESPAWNED, {
      entityId: entity.id,
      sceneId:  entity.sceneId,
    }).catch(() => undefined)

    return entity
  }

  async reconcileEntity(entityId: string, params: ReconcileEntityParams): Promise<AtcWorldEntity> {
    const conn = await this.pool.getConnection()
    try {
      const sets: string[] = ['x = ?', 'y = ?', 'z = ?', 'heading = ?']
      const values: (string | number)[] = [params.x, params.y, params.z, params.heading]

      if (params.networkId !== undefined) {
        sets.push('network_id = ?')
        values.push(params.networkId)
      }

      values.push(entityId)

      await conn.execute(
        `UPDATE atc_world_entities SET ${sets.join(', ')} WHERE id = ?`,
        values,
      )

      const entity = await this.entityRepo.findById(entityId, conn)
      if (!entity) throw new WorldEntityNotFoundError(entityId)

      this.eventBus?.emit(ATC_WORLD_EVENTS.ENTITY_RECONCILED, {
        entityId: entity.id,
        x:        entity.x,
        y:        entity.y,
        z:        entity.z,
        heading:  entity.heading,
      }).catch(() => undefined)

      return entity
    } finally {
      conn.release()
    }
  }

  async listByStatus(status: AtcWorldEntityStatus): Promise<AtcWorldEntity[]> {
    return this.entityRepo.listByStatus(status)
  }
}
