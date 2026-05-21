import type { RowDataPacket } from 'mysql2/promise'
import type { AtcSceneRuntime, AtcSceneStatus } from '@atc/shared-types'
import type { WorldPool } from './pool.js'
import { generateId } from './id.js'
import {
  SceneNotFoundError,
  SceneAlreadyExistsError,
  SceneImmutableError,
} from './errors.js'

interface SceneRow extends RowDataPacket {
  id: string
  scene_id: string
  creator_principal_id: string
  label: string
  is_locked: number
  status: string
  replication_node: string | null
  entity_count: number
  created_at: Date
  updated_at: Date
}

function rowToScene(row: SceneRow): AtcSceneRuntime {
  return {
    id: row.id,
    sceneId: row.scene_id,
    creatorPrincipalId: row.creator_principal_id,
    label: row.label,
    isLocked: row.is_locked === 1,
    status: row.status as AtcSceneStatus,
    replicationNode: row.replication_node,
    entityCount: row.entity_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const ALLOWED_TRANSITIONS: Record<AtcSceneStatus, AtcSceneStatus[]> = {
  active:          ['suspended', 'destroyed', 'cleanup_pending'],
  suspended:       ['active', 'destroyed', 'cleanup_pending'],
  destroyed:       [],
  cleanup_pending: ['destroyed'],
}

export interface CreateSceneParams {
  sceneId: string
  creatorPrincipalId: string
  label: string
  replicationNode?: string | undefined
}

export class SceneRuntimeRepository {
  constructor(private readonly pool: WorldPool) {}

  async create(params: CreateSceneParams): Promise<AtcSceneRuntime> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_scene_runtime
             (id, scene_id, creator_principal_id, label, is_locked, status,
              replication_node, entity_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, 'active', ?, 0, NOW(3), NOW(3))`,
          [
            id,
            params.sceneId,
            params.creatorPrincipalId,
            params.label,
            params.replicationNode ?? null,
          ],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new SceneAlreadyExistsError(params.sceneId)
        }
        throw err
      }
      const [rows] = await conn.execute<SceneRow[]>(
        `SELECT * FROM atc_scene_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new SceneNotFoundError(params.sceneId)
      return rowToScene(rows[0])
    } finally {
      conn.release()
    }
  }

  async findBySceneId(
    sceneId: string,
    conn?: Awaited<ReturnType<WorldPool['getConnection']>>,
  ): Promise<AtcSceneRuntime | null> {
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      const [rows] = await connection.execute<SceneRow[]>(
        `SELECT * FROM atc_scene_runtime WHERE scene_id = ? LIMIT 1`,
        [sceneId],
      )
      return rows[0] ? rowToScene(rows[0]) : null
    } finally {
      if (owned) connection.release()
    }
  }

  async transition(
    sceneId: string,
    toStatus: AtcSceneStatus,
    conn?: Awaited<ReturnType<WorldPool['getConnection']>>,
  ): Promise<AtcSceneRuntime> {
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      const [rows] = await connection.execute<SceneRow[]>(
        `SELECT * FROM atc_scene_runtime WHERE scene_id = ? LIMIT 1 FOR UPDATE`,
        [sceneId],
      )
      if (!rows[0]) throw new SceneNotFoundError(sceneId)
      const current = rows[0].status as AtcSceneStatus
      const allowed = ALLOWED_TRANSITIONS[current]
      if (!allowed.includes(toStatus)) {
        throw new SceneImmutableError(sceneId, current, toStatus)
      }
      await connection.execute(
        `UPDATE atc_scene_runtime SET status = ? WHERE scene_id = ?`,
        [toStatus, sceneId],
      )
      const [updated] = await connection.execute<SceneRow[]>(
        `SELECT * FROM atc_scene_runtime WHERE scene_id = ? LIMIT 1`,
        [sceneId],
      )
      if (!updated[0]) throw new SceneNotFoundError(sceneId)
      return rowToScene(updated[0])
    } finally {
      if (owned) connection.release()
    }
  }

  async setLocked(sceneId: string, isLocked: boolean): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_scene_runtime SET is_locked = ? WHERE scene_id = ?`,
        [isLocked ? 1 : 0, sceneId],
      )
    } finally {
      conn.release()
    }
  }

  async setReplicationNode(sceneId: string, nodeId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_scene_runtime SET replication_node = ? WHERE scene_id = ?`,
        [nodeId, sceneId],
      )
    } finally {
      conn.release()
    }
  }

  async incrementEntityCount(
    sceneId: string,
    conn?: Awaited<ReturnType<WorldPool['getConnection']>>,
  ): Promise<void> {
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      await connection.execute(
        `UPDATE atc_scene_runtime SET entity_count = entity_count + 1 WHERE scene_id = ?`,
        [sceneId],
      )
    } finally {
      if (owned) connection.release()
    }
  }

  async decrementEntityCount(
    sceneId: string,
    conn?: Awaited<ReturnType<WorldPool['getConnection']>>,
  ): Promise<void> {
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      await connection.execute(
        `UPDATE atc_scene_runtime SET entity_count = GREATEST(0, entity_count - 1) WHERE scene_id = ?`,
        [sceneId],
      )
    } finally {
      if (owned) connection.release()
    }
  }

  async listActive(): Promise<AtcSceneRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SceneRow[]>(
        `SELECT * FROM atc_scene_runtime WHERE status = 'active' ORDER BY created_at ASC`,
      )
      return rows.map(rowToScene)
    } finally {
      conn.release()
    }
  }

  async listByStatus(status: AtcSceneStatus): Promise<AtcSceneRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SceneRow[]>(
        `SELECT * FROM atc_scene_runtime WHERE status = ? ORDER BY created_at ASC`,
        [status],
      )
      return rows.map(rowToScene)
    } finally {
      conn.release()
    }
  }

  async listByNode(nodeId: string): Promise<AtcSceneRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SceneRow[]>(
        `SELECT * FROM atc_scene_runtime WHERE replication_node = ? ORDER BY created_at ASC`,
        [nodeId],
      )
      return rows.map(rowToScene)
    } finally {
      conn.release()
    }
  }
}
