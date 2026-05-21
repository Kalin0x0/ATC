import type { RowDataPacket } from 'mysql2/promise'
import type { AtcRuntimeCleanup, AtcCleanupReason } from '@atc/shared-types'
import { ATC_WORLD_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { RuntimeCleanupRepository } from './runtime-cleanup.repository.js'
import type { WorldEntityRepository } from './world-entity.repository.js'
import type { SceneRuntimeRepository } from './scene-runtime.repository.js'
import type { WorldPool } from './pool.js'
import { CleanupNotFoundError } from './errors.js'

export interface CleanupOrchestrationDeps {
  cleanupRepo: RuntimeCleanupRepository
  entityRepo: WorldEntityRepository
  sceneRepo: SceneRuntimeRepository
  pool: WorldPool
  eventBus: AtcEventBus | undefined
}

export interface ScheduleCleanupServiceParams {
  targetType: string
  targetId: string
  cleanupReason: AtcCleanupReason
  nodeId?: string | undefined
}

interface StaleRow extends RowDataPacket {
  id: string
}

export class CleanupOrchestrationService {
  private readonly cleanupRepo: RuntimeCleanupRepository
  private readonly entityRepo: WorldEntityRepository
  private readonly sceneRepo: SceneRuntimeRepository
  private readonly pool: WorldPool
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: CleanupOrchestrationDeps) {
    this.cleanupRepo = deps.cleanupRepo
    this.entityRepo  = deps.entityRepo
    this.sceneRepo   = deps.sceneRepo
    this.pool        = deps.pool
    this.eventBus    = deps.eventBus
  }

  async scheduleCleanup(params: ScheduleCleanupServiceParams): Promise<AtcRuntimeCleanup> {
    const cleanup = await this.cleanupRepo.schedule({
      targetType:    params.targetType,
      targetId:      params.targetId,
      cleanupReason: params.cleanupReason,
      nodeId:        params.nodeId,
    })

    this.eventBus?.emit(ATC_WORLD_EVENTS.CLEANUP_SCHEDULED, {
      cleanupId:  cleanup.id,
      targetType: cleanup.targetType,
      targetId:   cleanup.targetId,
      reason:     cleanup.cleanupReason,
    }).catch(() => undefined)

    return cleanup
  }

  async completeCleanup(cleanupId: string): Promise<AtcRuntimeCleanup> {
    const existing = await this.cleanupRepo.findById(cleanupId)
    if (!existing) throw new CleanupNotFoundError(cleanupId)

    const cleanup = await this.cleanupRepo.complete(cleanupId)

    this.eventBus?.emit(ATC_WORLD_EVENTS.CLEANUP_COMPLETED, {
      cleanupId:  cleanup.id,
      targetType: cleanup.targetType,
      targetId:   cleanup.targetId,
    }).catch(() => undefined)

    return cleanup
  }

  async processPendingCleanups(nodeId?: string): Promise<{ processed: number }> {
    const pending = await this.cleanupRepo.listPending(nodeId)
    if (pending.length === 0) return { processed: 0 }

    // Mark entity targets as cleanup_pending then cleaned
    const entityIds = pending
      .filter(c => c.targetType === 'world_entity')
      .map(c => c.targetId)

    if (entityIds.length > 0) {
      await this.entityRepo.markCleanupPending(entityIds).catch(() => undefined)
      await this.entityRepo.markCleaned(entityIds).catch(() => undefined)
    }

    let processed = 0
    for (const cleanup of pending) {
      try {
        await this.cleanupRepo.complete(cleanup.id)
        this.eventBus?.emit(ATC_WORLD_EVENTS.CLEANUP_COMPLETED, {
          cleanupId:  cleanup.id,
          targetType: cleanup.targetType,
          targetId:   cleanup.targetId,
        }).catch(() => undefined)
        processed++
      } catch {
        // Continue processing remaining cleanups
      }
    }

    return { processed }
  }

  async cleanupStaleEntities(olderThanMinutes: number): Promise<{ scheduled: number }> {
    const conn = await this.pool.getConnection()
    let staleIds: string[]
    try {
      const [rows] = await conn.execute<StaleRow[]>(
        `SELECT id FROM atc_world_entities
         WHERE status IN ('active', 'registered')
           AND spawned_at < DATE_SUB(NOW(3), INTERVAL ? MINUTE)`,
        [olderThanMinutes],
      )
      staleIds = rows.map(r => r.id)
    } finally {
      conn.release()
    }

    let scheduled = 0
    for (const entityId of staleIds) {
      try {
        await this.scheduleCleanup({
          targetType:    'world_entity',
          targetId:      entityId,
          cleanupReason: 'timeout',
        })
        scheduled++
      } catch {
        // Continue scheduling remaining entities
      }
    }

    return { scheduled }
  }

  async listPendingCleanups(nodeId?: string): Promise<AtcRuntimeCleanup[]> {
    return this.cleanupRepo.listPending(nodeId)
  }
}
