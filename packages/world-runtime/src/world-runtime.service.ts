import type { AtcWorldEntity, AtcSceneRuntime } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { WorldEntityRepository } from './world-entity.repository.js'
import type { SceneRuntimeRepository } from './scene-runtime.repository.js'
import type { WorldPool } from './pool.js'

export interface WorldRuntimeDeps {
  entityRepo: WorldEntityRepository
  sceneRepo: SceneRuntimeRepository
  pool: WorldPool
  eventBus: AtcEventBus | undefined
}

export class WorldRuntimeService {
  private readonly entityRepo: WorldEntityRepository
  private readonly sceneRepo: SceneRuntimeRepository

  constructor(deps: WorldRuntimeDeps) {
    this.entityRepo = deps.entityRepo
    this.sceneRepo  = deps.sceneRepo
  }

  async getEntityStatus(entityId: string): Promise<AtcWorldEntity | null> {
    return this.entityRepo.findById(entityId)
  }

  async getSceneStatus(sceneId: string): Promise<AtcSceneRuntime | null> {
    return this.sceneRepo.findBySceneId(sceneId)
  }

  async listActiveScenes(): Promise<AtcSceneRuntime[]> {
    return this.sceneRepo.listActive()
  }

  async listEntitiesByScene(sceneId: string): Promise<AtcWorldEntity[]> {
    return this.entityRepo.listByScene(sceneId)
  }

  async listEntitiesByOwner(principalId: string): Promise<AtcWorldEntity[]> {
    return this.entityRepo.listByOwner(principalId)
  }
}
