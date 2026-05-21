import type { RowDataPacket } from 'mysql2/promise'
import type { AtcWorldEntity, AtcWorldEntityStatus, AtcWorldEntityType } from '@atc/shared-types'
import type { WorldPool } from './pool.js'
import { generateId } from './id.js'
import {
  WorldEntityNotFoundError,
  WorldEntityAlreadySpawnedError,
  WorldEntityImmutableError,
} from './errors.js'

interface EntityRow extends RowDataPacket {
  id: string
  entity_type: string
  owner_principal_id: string | null
  network_id: number | null
  model: string
  x: number
  y: number
  z: number
  heading: number
  spawn_nonce: string
  status: string
  scene_id: string | null
  spawned_at: Date
  despawned_at: Date | null
  created_at: Date
}

function rowToEntity(row: EntityRow): AtcWorldEntity {
  return {
    id: row.id,
    entityType: row.entity_type as AtcWorldEntityType,
    ownerPrincipalId: row.owner_principal_id,
    networkId: row.network_id,
    model: row.model,
    x: row.x,
    y: row.y,
    z: row.z,
    heading: row.heading,
    spawnNonce: row.spawn_nonce,
    status: row.status as AtcWorldEntityStatus,
    sceneId: row.scene_id,
    spawnedAt: row.spawned_at,
    despawnedAt: row.despawned_at,
    createdAt: row.created_at,
  }
}

const ALLOWED_TRANSITIONS: Record<AtcWorldEntityStatus, AtcWorldEntityStatus[]> = {
  registered:      ['active', 'despawned', 'cleanup_pending'],
  active:          ['despawned', 'cleanup_pending', 'cleaned'],
  despawned:       ['active', 'cleanup_pending', 'cleaned'],
  cleanup_pending: ['cleaned'],
  cleaned:         [],
}

export interface RegisterEntityParams {
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

export class WorldEntityRepository {
  constructor(private readonly pool: WorldPool) {}

  async register(params: RegisterEntityParams): Promise<AtcWorldEntity> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_world_entities
             (id, entity_type, owner_principal_id, network_id, model,
              x, y, z, heading, spawn_nonce, status, scene_id, spawned_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'registered', ?, NOW(3), NOW(3))`,
          [
            id,
            params.entityType,
            params.ownerPrincipalId ?? null,
            params.networkId ?? null,
            params.model,
            params.x,
            params.y,
            params.z,
            params.heading,
            params.spawnNonce,
            params.sceneId ?? null,
          ],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new WorldEntityAlreadySpawnedError(params.spawnNonce)
        }
        throw err
      }
      const [rows] = await conn.execute<EntityRow[]>(
        `SELECT * FROM atc_world_entities WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new WorldEntityNotFoundError(id)
      return rowToEntity(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(
    id: string,
    conn?: Awaited<ReturnType<WorldPool['getConnection']>>,
  ): Promise<AtcWorldEntity | null> {
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      const [rows] = await connection.execute<EntityRow[]>(
        `SELECT * FROM atc_world_entities WHERE id = ? LIMIT 1`,
        [id],
      )
      return rows[0] ? rowToEntity(rows[0]) : null
    } finally {
      if (owned) connection.release()
    }
  }

  async findByNetworkId(networkId: number): Promise<AtcWorldEntity | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EntityRow[]>(
        `SELECT * FROM atc_world_entities WHERE network_id = ? AND status NOT IN ('despawned','cleaned') LIMIT 1`,
        [networkId],
      )
      return rows[0] ? rowToEntity(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async transition(
    id: string,
    toStatus: AtcWorldEntityStatus,
    conn?: Awaited<ReturnType<WorldPool['getConnection']>>,
  ): Promise<AtcWorldEntity> {
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      const [rows] = await connection.execute<EntityRow[]>(
        `SELECT * FROM atc_world_entities WHERE id = ? LIMIT 1 FOR UPDATE`,
        [id],
      )
      if (!rows[0]) throw new WorldEntityNotFoundError(id)
      const current = rows[0].status as AtcWorldEntityStatus
      const allowed = ALLOWED_TRANSITIONS[current]
      if (!allowed.includes(toStatus)) {
        throw new WorldEntityImmutableError(id, current, toStatus)
      }
      await connection.execute(
        `UPDATE atc_world_entities SET status = ?, spawned_at = spawned_at WHERE id = ?`,
        [toStatus, id],
      )
      const [updated] = await connection.execute<EntityRow[]>(
        `SELECT * FROM atc_world_entities WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!updated[0]) throw new WorldEntityNotFoundError(id)
      return rowToEntity(updated[0])
    } finally {
      if (owned) connection.release()
    }
  }

  async despawn(id: string): Promise<AtcWorldEntity> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EntityRow[]>(
        `SELECT * FROM atc_world_entities WHERE id = ? LIMIT 1 FOR UPDATE`,
        [id],
      )
      if (!rows[0]) throw new WorldEntityNotFoundError(id)
      const current = rows[0].status as AtcWorldEntityStatus
      const allowed = ALLOWED_TRANSITIONS[current]
      if (!allowed.includes('despawned')) {
        throw new WorldEntityImmutableError(id, current, 'despawned')
      }
      await conn.execute(
        `UPDATE atc_world_entities SET status = 'despawned', despawned_at = NOW(3) WHERE id = ?`,
        [id],
      )
      const [updated] = await conn.execute<EntityRow[]>(
        `SELECT * FROM atc_world_entities WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!updated[0]) throw new WorldEntityNotFoundError(id)
      return rowToEntity(updated[0])
    } finally {
      conn.release()
    }
  }

  async listByOwner(principalId: string): Promise<AtcWorldEntity[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EntityRow[]>(
        `SELECT * FROM atc_world_entities WHERE owner_principal_id = ? ORDER BY spawned_at DESC`,
        [principalId],
      )
      return rows.map(rowToEntity)
    } finally {
      conn.release()
    }
  }

  async listByScene(sceneId: string): Promise<AtcWorldEntity[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EntityRow[]>(
        `SELECT * FROM atc_world_entities WHERE scene_id = ? ORDER BY spawned_at ASC`,
        [sceneId],
      )
      return rows.map(rowToEntity)
    } finally {
      conn.release()
    }
  }

  async listByStatus(status: AtcWorldEntityStatus): Promise<AtcWorldEntity[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EntityRow[]>(
        `SELECT * FROM atc_world_entities WHERE status = ? ORDER BY spawned_at ASC`,
        [status],
      )
      return rows.map(rowToEntity)
    } finally {
      conn.release()
    }
  }

  async markCleanupPending(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_world_entities SET status = 'cleanup_pending' WHERE id IN (?) AND status NOT IN ('cleaned')`,
        [ids],
      )
    } finally {
      conn.release()
    }
  }

  async markCleaned(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_world_entities SET status = 'cleaned' WHERE id IN (?)`,
        [ids],
      )
    } finally {
      conn.release()
    }
  }
}
