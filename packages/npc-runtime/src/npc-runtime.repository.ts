import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { NpcRuntimePool } from './pool.js'
import { generateId } from './id.js'
import {
  NpcNotFoundError,
  NpcAlreadyOwnedError,
  NpcSpawnNonceConflictError,
} from './errors.js'

export type AtcNpcStatus = 'spawned' | 'despawned' | 'cleanup_pending'
export type AtcNpcType = 'civilian' | 'pedestrian' | 'ambient' | 'scripted' | 'emergency'

export interface AtcNpcRuntime {
  id: string
  spawnNonce: string
  npcType: AtcNpcType
  modelHash: string | null
  ownerServerId: string | null
  zoneId: string | null
  positionX: number | null
  positionY: number | null
  positionZ: number | null
  status: AtcNpcStatus
  spawnedAt: Date
  despawnedAt: Date | null
  lastHeartbeatAt: Date
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface SpawnNpcParams {
  spawnNonce: string
  npcType: AtcNpcType
  modelHash?: string | null | undefined
  ownerServerId?: string | null | undefined
  zoneId?: string | null | undefined
  positionX?: number | null | undefined
  positionY?: number | null | undefined
  positionZ?: number | null | undefined
  metadata?: Record<string, unknown> | undefined
}

interface NpcRuntimeRow extends RowDataPacket {
  id: string
  spawn_nonce: string
  npc_type: string
  model_hash: string | null
  owner_server_id: string | null
  zone_id: string | null
  position_x: number | null
  position_y: number | null
  position_z: number | null
  status: string
  spawned_at: Date
  despawned_at: Date | null
  last_heartbeat_at: Date
  metadata: string
  created_at: Date
  updated_at: Date
}

function rowToNpc(row: NpcRuntimeRow): AtcNpcRuntime {
  return {
    id: row.id,
    spawnNonce: row.spawn_nonce,
    npcType: row.npc_type as AtcNpcType,
    modelHash: row.model_hash,
    ownerServerId: row.owner_server_id,
    zoneId: row.zone_id,
    positionX: row.position_x !== null ? Number(row.position_x) : null,
    positionY: row.position_y !== null ? Number(row.position_y) : null,
    positionZ: row.position_z !== null ? Number(row.position_z) : null,
    status: row.status as AtcNpcStatus,
    spawnedAt: row.spawned_at,
    despawnedAt: row.despawned_at,
    lastHeartbeatAt: row.last_heartbeat_at,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class NpcRuntimeRepository {
  constructor(private readonly pool: NpcRuntimePool) {}

  async spawn(params: SpawnNpcParams): Promise<AtcNpcRuntime> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_npc_runtime
             (id, spawn_nonce, npc_type, model_hash, owner_server_id, zone_id,
              position_x, position_y, position_z, status,
              spawned_at, last_heartbeat_at, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'spawned', NOW(3), NOW(3), ?, NOW(3), NOW(3))`,
          [
            id,
            params.spawnNonce,
            params.npcType,
            params.modelHash ?? null,
            params.ownerServerId ?? null,
            params.zoneId ?? null,
            params.positionX ?? null,
            params.positionY ?? null,
            params.positionZ ?? null,
            JSON.stringify(params.metadata ?? {}),
          ],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new NpcSpawnNonceConflictError(params.spawnNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<NpcRuntimeRow[]>(
        `SELECT * FROM atc_npc_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new NpcNotFoundError(id)
      return rowToNpc(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcNpcRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<NpcRuntimeRow[]>(
        `SELECT * FROM atc_npc_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      return rows[0] ? rowToNpc(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByNonce(nonce: string): Promise<AtcNpcRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<NpcRuntimeRow[]>(
        `SELECT * FROM atc_npc_runtime WHERE spawn_nonce = ? LIMIT 1`,
        [nonce],
      )
      return rows[0] ? rowToNpc(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByOwner(ownerServerId: string): Promise<AtcNpcRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<NpcRuntimeRow[]>(
        `SELECT * FROM atc_npc_runtime
         WHERE owner_server_id = ? AND status = 'spawned'
         ORDER BY spawned_at DESC`,
        [ownerServerId],
      )
      return rows.map(rowToNpc)
    } finally {
      conn.release()
    }
  }

  async despawn(id: string): Promise<AtcNpcRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_npc_runtime
         SET status = 'despawned', despawned_at = NOW(3), updated_at = NOW(3)
         WHERE id = ?`,
        [id],
      )
      const [rows] = await conn.execute<NpcRuntimeRow[]>(
        `SELECT * FROM atc_npc_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new NpcNotFoundError(id)
      return rowToNpc(rows[0])
    } finally {
      conn.release()
    }
  }

  async claimOwnership(id: string, ownerServerId: string): Promise<AtcNpcRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<NpcRuntimeRow[]>(
          `SELECT * FROM atc_npc_runtime WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        if (!rows[0]) throw new NpcNotFoundError(id)

        const current = rowToNpc(rows[0])

        if (current.ownerServerId !== null) {
          if (current.ownerServerId === ownerServerId) {
            // Idempotent — already owned by the same server
            await conn.rollback()
            return current
          }
          throw new NpcAlreadyOwnedError(id)
        }

        await conn.execute(
          `UPDATE atc_npc_runtime
           SET owner_server_id = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [ownerServerId, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<NpcRuntimeRow[]>(
        `SELECT * FROM atc_npc_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new NpcNotFoundError(id)
      return rowToNpc(rows[0])
    } finally {
      conn.release()
    }
  }

  async releaseOwnership(id: string): Promise<AtcNpcRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_npc_runtime
         SET owner_server_id = NULL, updated_at = NOW(3)
         WHERE id = ?`,
        [id],
      )
      const [rows] = await conn.execute<NpcRuntimeRow[]>(
        `SELECT * FROM atc_npc_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new NpcNotFoundError(id)
      return rowToNpc(rows[0])
    } finally {
      conn.release()
    }
  }

  async heartbeat(id: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_npc_runtime
         SET last_heartbeat_at = NOW(3), updated_at = NOW(3)
         WHERE id = ?`,
        [id],
      )
    } finally {
      conn.release()
    }
  }

  async listStale(olderThanMinutes: number): Promise<AtcNpcRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<NpcRuntimeRow[]>(
        `SELECT * FROM atc_npc_runtime
         WHERE status = 'spawned'
           AND last_heartbeat_at < DATE_SUB(NOW(3), INTERVAL ? MINUTE)`,
        [olderThanMinutes],
      )
      return rows.map(rowToNpc)
    } finally {
      conn.release()
    }
  }

  async markForCleanup(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const conn = await this.pool.getConnection()
    try {
      const placeholders = ids.map(() => '?').join(', ')
      await conn.execute(
        `UPDATE atc_npc_runtime
         SET status = 'cleanup_pending', updated_at = NOW(3)
         WHERE id IN (${placeholders})`,
        ids,
      )
    } finally {
      conn.release()
    }
  }

  async deleteByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0
    const conn = await this.pool.getConnection()
    try {
      const placeholders = ids.map(() => '?').join(', ')
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_npc_runtime WHERE id IN (${placeholders})`,
        ids,
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
