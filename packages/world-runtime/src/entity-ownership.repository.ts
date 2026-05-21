import type { RowDataPacket } from 'mysql2/promise'
import type { AtcEntityOwnership } from '@atc/shared-types'
import type { WorldPool } from './pool.js'
import { generateId } from './id.js'
import { OwnershipConflictError, OwnershipNotFoundError } from './errors.js'

interface OwnershipRow extends RowDataPacket {
  id: string
  entity_id: string
  scene_id: string | null
  principal_id: string
  acquired_at: Date
  released_at: Date | null
}

function rowToOwnership(row: OwnershipRow): AtcEntityOwnership {
  return {
    id: row.id,
    entityId: row.entity_id,
    sceneId: row.scene_id,
    principalId: row.principal_id,
    acquiredAt: row.acquired_at,
    releasedAt: row.released_at,
  }
}

export interface AcquireOwnershipParams {
  entityId: string
  sceneId?: string | undefined
  principalId: string
}

export class EntityOwnershipRepository {
  constructor(private readonly pool: WorldPool) {}

  async acquire(
    params: AcquireOwnershipParams,
    conn?: Awaited<ReturnType<WorldPool['getConnection']>>,
  ): Promise<AtcEntityOwnership> {
    const id = generateId()
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      // Check for existing active ownership with lock
      const [existing] = await connection.execute<OwnershipRow[]>(
        `SELECT * FROM atc_entity_ownership
         WHERE entity_id = ? AND released_at IS NULL
         LIMIT 1 FOR UPDATE`,
        [params.entityId],
      )
      if (existing[0]) {
        throw new OwnershipConflictError(params.entityId)
      }

      await connection.execute(
        `INSERT INTO atc_entity_ownership
           (id, entity_id, scene_id, principal_id, acquired_at)
         VALUES (?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.entityId,
          params.sceneId ?? null,
          params.principalId,
        ],
      )

      const [rows] = await connection.execute<OwnershipRow[]>(
        `SELECT * FROM atc_entity_ownership WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new OwnershipConflictError(params.entityId)
      return rowToOwnership(rows[0])
    } finally {
      if (owned) connection.release()
    }
  }

  async release(
    entityId: string,
    principalId: string,
    conn?: Awaited<ReturnType<WorldPool['getConnection']>>,
  ): Promise<AtcEntityOwnership> {
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      const [rows] = await connection.execute<OwnershipRow[]>(
        `SELECT * FROM atc_entity_ownership
         WHERE entity_id = ? AND principal_id = ? AND released_at IS NULL
         LIMIT 1 FOR UPDATE`,
        [entityId, principalId],
      )
      if (!rows[0]) throw new OwnershipNotFoundError(entityId, principalId)

      await connection.execute(
        `UPDATE atc_entity_ownership SET released_at = NOW(3) WHERE id = ?`,
        [rows[0].id],
      )

      const [updated] = await connection.execute<OwnershipRow[]>(
        `SELECT * FROM atc_entity_ownership WHERE id = ? LIMIT 1`,
        [rows[0].id],
      )
      if (!updated[0]) throw new OwnershipNotFoundError(entityId, principalId)
      return rowToOwnership(updated[0])
    } finally {
      if (owned) connection.release()
    }
  }

  async findActive(entityId: string): Promise<AtcEntityOwnership | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<OwnershipRow[]>(
        `SELECT * FROM atc_entity_ownership
         WHERE entity_id = ? AND released_at IS NULL
         ORDER BY acquired_at DESC LIMIT 1`,
        [entityId],
      )
      return rows[0] ? rowToOwnership(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listActiveByPrincipal(principalId: string): Promise<AtcEntityOwnership[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<OwnershipRow[]>(
        `SELECT * FROM atc_entity_ownership
         WHERE principal_id = ? AND released_at IS NULL
         ORDER BY acquired_at DESC`,
        [principalId],
      )
      return rows.map(rowToOwnership)
    } finally {
      conn.release()
    }
  }

  async listActiveByScene(sceneId: string): Promise<AtcEntityOwnership[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<OwnershipRow[]>(
        `SELECT * FROM atc_entity_ownership
         WHERE scene_id = ? AND released_at IS NULL
         ORDER BY acquired_at ASC`,
        [sceneId],
      )
      return rows.map(rowToOwnership)
    } finally {
      conn.release()
    }
  }

  async releaseAll(
    sceneId: string,
    conn?: Awaited<ReturnType<WorldPool['getConnection']>>,
  ): Promise<void> {
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      await connection.execute(
        `UPDATE atc_entity_ownership
         SET released_at = NOW(3)
         WHERE scene_id = ? AND released_at IS NULL`,
        [sceneId],
      )
    } finally {
      if (owned) connection.release()
    }
  }
}
