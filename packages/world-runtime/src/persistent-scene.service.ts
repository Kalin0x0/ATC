import type { AtcPersistentScene, AtcPersistentSceneType } from '@atc/shared-types'
import { ATC_WORLD_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { PersistentSceneRepository } from './persistent-scene.repository.js'
import { PersistentSceneNotFoundError } from './errors.js'

export interface PersistentSceneDeps {
  persistentRepo: PersistentSceneRepository
  eventBus: AtcEventBus | undefined
}

export interface PersistSceneServiceParams {
  sceneId: string
  sceneType: AtcPersistentSceneType
  worldRegion?: string | undefined
  data: Record<string, unknown>
  expiresInSeconds?: number | undefined
}

export class PersistentSceneService {
  private readonly persistentRepo: PersistentSceneRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: PersistentSceneDeps) {
    this.persistentRepo = deps.persistentRepo
    this.eventBus       = deps.eventBus
  }

  async persistScene(params: PersistSceneServiceParams): Promise<AtcPersistentScene> {
    const scene = await this.persistentRepo.persist({
      sceneId:         params.sceneId,
      sceneType:       params.sceneType,
      worldRegion:     params.worldRegion,
      data:            params.data,
      expiresInSeconds: params.expiresInSeconds,
    })

    this.eventBus?.emit(ATC_WORLD_EVENTS.PERSISTENT_SCENE_SAVED, {
      sceneId:   scene.sceneId,
      sceneType: scene.sceneType,
    }).catch(() => undefined)

    return scene
  }

  async restoreScene(sceneId: string): Promise<AtcPersistentScene> {
    const scene = await this.persistentRepo.findBySceneId(sceneId)
    if (!scene) throw new PersistentSceneNotFoundError(sceneId)

    await this.persistentRepo.markRestored(sceneId)

    const restored = await this.persistentRepo.findBySceneId(sceneId)
    if (!restored) throw new PersistentSceneNotFoundError(sceneId)

    this.eventBus?.emit(ATC_WORLD_EVENTS.PERSISTENT_SCENE_RESTORED, {
      sceneId: restored.sceneId,
    }).catch(() => undefined)

    return restored
  }

  async findBySceneId(sceneId: string): Promise<AtcPersistentScene | null> {
    return this.persistentRepo.findBySceneId(sceneId)
  }

  async listExpired(): Promise<AtcPersistentScene[]> {
    return this.persistentRepo.listExpired()
  }

  async listByType(sceneType: AtcPersistentSceneType): Promise<AtcPersistentScene[]> {
    return this.persistentRepo.listByType(sceneType)
  }

  async listByRegion(worldRegion: string): Promise<AtcPersistentScene[]> {
    return this.persistentRepo.listByRegion(worldRegion)
  }

  async cleanupExpired(): Promise<void> {
    await this.persistentRepo.deleteExpired()
  }
}
