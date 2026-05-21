import type { AtcSceneRuntime } from '@atc/shared-types'
import { ATC_WORLD_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { SceneRuntimeRepository, CreateSceneParams } from './scene-runtime.repository.js'
import type { WorldEntityRepository } from './world-entity.repository.js'
import type { EntityOwnershipRepository } from './entity-ownership.repository.js'
import type { WorldPool } from './pool.js'
import { SceneNotFoundError } from './errors.js'

export type { CreateSceneParams }

export interface SceneSynchronizationDeps {
  sceneRepo: SceneRuntimeRepository
  entityRepo: WorldEntityRepository
  ownershipRepo: EntityOwnershipRepository
  pool: WorldPool
  eventBus: AtcEventBus | undefined
}

export class SceneSynchronizationService {
  private readonly sceneRepo: SceneRuntimeRepository
  private readonly entityRepo: WorldEntityRepository
  private readonly ownershipRepo: EntityOwnershipRepository
  private readonly pool: WorldPool
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: SceneSynchronizationDeps) {
    this.sceneRepo     = deps.sceneRepo
    this.entityRepo    = deps.entityRepo
    this.ownershipRepo = deps.ownershipRepo
    this.pool          = deps.pool
    this.eventBus      = deps.eventBus
  }

  async createScene(params: CreateSceneParams): Promise<AtcSceneRuntime> {
    const scene = await this.sceneRepo.create({
      sceneId:             params.sceneId,
      creatorPrincipalId:  params.creatorPrincipalId,
      label:               params.label,
      replicationNode:     params.replicationNode,
    })

    this.eventBus?.emit(ATC_WORLD_EVENTS.SCENE_CREATED, {
      sceneId:            scene.sceneId,
      creatorPrincipalId: scene.creatorPrincipalId,
      label:              scene.label,
    }).catch(() => undefined)

    return scene
  }

  async destroyScene(sceneId: string): Promise<AtcSceneRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      let scene: AtcSceneRuntime
      try {
        scene = await this.sceneRepo.transition(sceneId, 'destroyed', conn)
        await this.ownershipRepo.releaseAll(sceneId, conn)
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      this.eventBus?.emit(ATC_WORLD_EVENTS.SCENE_DESTROYED, { sceneId }).catch(() => undefined)

      return scene
    } finally {
      conn.release()
    }
  }

  async suspendScene(sceneId: string): Promise<AtcSceneRuntime> {
    const scene = await this.sceneRepo.transition(sceneId, 'suspended')

    this.eventBus?.emit(ATC_WORLD_EVENTS.SCENE_SUSPENDED, { sceneId }).catch(() => undefined)

    return scene
  }

  async setSceneNode(sceneId: string, nodeId: string): Promise<void> {
    const scene = await this.sceneRepo.findBySceneId(sceneId)
    if (!scene) throw new SceneNotFoundError(sceneId)
    await this.sceneRepo.setReplicationNode(sceneId, nodeId)
  }

  async lockScene(sceneId: string): Promise<void> {
    const scene = await this.sceneRepo.findBySceneId(sceneId)
    if (!scene) throw new SceneNotFoundError(sceneId)
    await this.sceneRepo.setLocked(sceneId, true)
  }

  async unlockScene(sceneId: string): Promise<void> {
    const scene = await this.sceneRepo.findBySceneId(sceneId)
    if (!scene) throw new SceneNotFoundError(sceneId)
    await this.sceneRepo.setLocked(sceneId, false)
  }
}
