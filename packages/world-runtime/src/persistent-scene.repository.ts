import type { RowDataPacket } from 'mysql2/promise'
import type { AtcPersistentScene, AtcPersistentSceneType } from '@atc/shared-types'
import type { WorldPool } from './pool.js'
import { generateId } from './id.js'
import { PersistentSceneNotFoundError } from './errors.js'

interface PersistentSceneRow extends RowDataPacket {
  id: string
  scene_id: string
  scene_type: string
  world_region: string | null
  data: string
  persisted_at: Date
  expires_at: Date | null
  restored_at: Date | null
}

function rowToScene(row: PersistentSceneRow): AtcPersistentScene {
  return {
    id: row.id,
    sceneId: row.scene_id,
    sceneType: row.scene_type as AtcPersistentSceneType,
    worldRegion: row.world_region,
    data: JSON.parse(row.data) as Record<string, unknown>,
    persistedAt: row.persisted_at,
    expiresAt: row.expires_at,
    restoredAt: row.restored_at,
  }
}

export interface PersistSceneParams {
  sceneId: string
  sceneType: AtcPersistentSceneType
  worldRegion?: string | undefined
  data: Record<string, unknown>
  expiresInSeconds?: number | undefined
}

export class PersistentSceneRepository {
  constructor(private readonly pool: WorldPool) {}

  async persist(params: PersistSceneParams): Promise<AtcPersistentScene> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_persistent_scenes
           (id, scene_id, scene_type, world_region, data, persisted_at, expires_at)
         VALUES (?, ?, ?, ?, ?, NOW(3),
           ${params.expiresInSeconds ? `DATE_ADD(NOW(3), INTERVAL ? SECOND)` : 'NULL'})`,
        params.expiresInSeconds
          ? [
              id,
              params.sceneId,
              params.sceneType,
              params.worldRegion ?? null,
              JSON.stringify(params.data),
              params.expiresInSeconds,
            ]
          : [
              id,
              params.sceneId,
              params.sceneType,
              params.worldRegion ?? null,
              JSON.stringify(params.data),
            ],
      )
      const [rows] = await conn.execute<PersistentSceneRow[]>(
        `SELECT * FROM atc_persistent_scenes WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new PersistentSceneNotFoundError(params.sceneId)
      return rowToScene(rows[0])
    } finally {
      conn.release()
    }
  }

  async findBySceneId(sceneId: string): Promise<AtcPersistentScene | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PersistentSceneRow[]>(
        `SELECT * FROM atc_persistent_scenes WHERE scene_id = ? ORDER BY persisted_at DESC LIMIT 1`,
        [sceneId],
      )
      return rows[0] ? rowToScene(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async markRestored(sceneId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_persistent_scenes SET restored_at = NOW(3) WHERE scene_id = ? AND restored_at IS NULL`,
        [sceneId],
      )
    } finally {
      conn.release()
    }
  }

  async listExpired(): Promise<AtcPersistentScene[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PersistentSceneRow[]>(
        `SELECT * FROM atc_persistent_scenes
         WHERE expires_at IS NOT NULL
           AND expires_at < NOW(3)
           AND restored_at IS NULL
         ORDER BY expires_at ASC`,
      )
      return rows.map(rowToScene)
    } finally {
      conn.release()
    }
  }

  async listByType(sceneType: AtcPersistentSceneType): Promise<AtcPersistentScene[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PersistentSceneRow[]>(
        `SELECT * FROM atc_persistent_scenes WHERE scene_type = ? ORDER BY persisted_at DESC`,
        [sceneType],
      )
      return rows.map(rowToScene)
    } finally {
      conn.release()
    }
  }

  async listByRegion(worldRegion: string): Promise<AtcPersistentScene[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PersistentSceneRow[]>(
        `SELECT * FROM atc_persistent_scenes WHERE world_region = ? ORDER BY persisted_at DESC`,
        [worldRegion],
      )
      return rows.map(rowToScene)
    } finally {
      conn.release()
    }
  }

  async deleteExpired(): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `DELETE FROM atc_persistent_scenes WHERE expires_at IS NOT NULL AND expires_at < NOW(3)`,
      )
    } finally {
      conn.release()
    }
  }
}
