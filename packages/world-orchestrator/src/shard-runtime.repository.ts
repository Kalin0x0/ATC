import type { RowDataPacket } from 'mysql2/promise'
import type { WorldOrchestratorPool } from './pool.js'
import { generateId } from './id.js'
import { ShardRuntimeNotFoundError } from './errors.js'

export type AtcShardType = 'world' | 'instance' | 'arena' | 'lobby' | 'custom'

export interface AtcShardRuntime {
  id: string
  shardId: string
  shardType: AtcShardType
  regionId: string | null
  ownerServerId: string
  capacityLimit: number | null
  currentLoad: number
  isActive: boolean
  transferredAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface UpsertShardParams {
  shardId: string
  shardType: AtcShardType
  ownerServerId: string
  regionId?: string | undefined
  capacityLimit?: number | undefined
}

interface AtcShardRuntimeRow extends RowDataPacket {
  id: string
  shard_id: string
  shard_type: string
  region_id: string | null
  owner_server_id: string
  capacity_limit: number | null
  current_load: number
  is_active: number
  transferred_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: AtcShardRuntimeRow): AtcShardRuntime {
  return {
    id: row.id,
    shardId: row.shard_id,
    shardType: row.shard_type as AtcShardType,
    regionId: row.region_id,
    ownerServerId: row.owner_server_id,
    capacityLimit: row.capacity_limit,
    currentLoad: row.current_load,
    isActive: row.is_active === 1,
    transferredAt: row.transferred_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ShardRuntimeRepository {
  constructor(private readonly pool: WorldOrchestratorPool) {}

  async findByShardId(shardId: string): Promise<AtcShardRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcShardRuntimeRow[]>(
        `SELECT id, shard_id, shard_type, region_id, owner_server_id,
                capacity_limit, current_load, is_active, transferred_at, created_at, updated_at
         FROM atc_shard_runtime
         WHERE shard_id = ?
         LIMIT 1`,
        [shardId],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async upsert(params: UpsertShardParams): Promise<AtcShardRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const binds: (string | number | boolean | null)[] = [
        id,
        params.shardId,
        params.shardType,
        params.regionId ?? null,
        params.ownerServerId,
        params.capacityLimit ?? null,
      ]

      await conn.execute(
        `INSERT INTO atc_shard_runtime
           (id, shard_id, shard_type, region_id, owner_server_id, capacity_limit, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           shard_type       = VALUES(shard_type),
           region_id        = VALUES(region_id),
           owner_server_id  = VALUES(owner_server_id),
           capacity_limit   = VALUES(capacity_limit),
           updated_at       = NOW(3)`,
        binds,
      )

      const result = await this.findByShardId(params.shardId)
      if (!result) throw new ShardRuntimeNotFoundError(params.shardId)
      return result
    } finally {
      conn.release()
    }
  }

  async transfer(shardId: string, fromServerId: string, toServerId: string): Promise<AtcShardRuntime> {
    const conn = await this.pool.getConnection()
    await conn.beginTransaction()
    try {
      const [rows] = await conn.execute<AtcShardRuntimeRow[]>(
        `SELECT id, shard_id, shard_type, region_id, owner_server_id,
                capacity_limit, current_load, is_active, transferred_at, created_at, updated_at
         FROM atc_shard_runtime
         WHERE shard_id = ?
         LIMIT 1
         FOR UPDATE`,
        [shardId],
      )

      if (!rows[0]) {
        throw new ShardRuntimeNotFoundError(shardId)
      }

      await conn.execute(
        `UPDATE atc_shard_runtime
         SET owner_server_id = ?, transferred_at = NOW(3), updated_at = NOW(3)
         WHERE shard_id = ? AND owner_server_id = ?`,
        [toServerId, shardId, fromServerId],
      )

      await conn.commit()

      const [updated] = await conn.execute<AtcShardRuntimeRow[]>(
        `SELECT id, shard_id, shard_type, region_id, owner_server_id,
                capacity_limit, current_load, is_active, transferred_at, created_at, updated_at
         FROM atc_shard_runtime
         WHERE shard_id = ?
         LIMIT 1`,
        [shardId],
      )

      if (!updated[0]) throw new ShardRuntimeNotFoundError(shardId)
      return mapRow(updated[0])
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async listByServerId(serverId: string): Promise<AtcShardRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcShardRuntimeRow[]>(
        `SELECT id, shard_id, shard_type, region_id, owner_server_id,
                capacity_limit, current_load, is_active, transferred_at, created_at, updated_at
         FROM atc_shard_runtime
         WHERE owner_server_id = ?
         ORDER BY created_at ASC`,
        [serverId],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcShardRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcShardRuntimeRow[]>(
        `SELECT id, shard_id, shard_type, region_id, owner_server_id,
                capacity_limit, current_load, is_active, transferred_at, created_at, updated_at
         FROM atc_shard_runtime
         WHERE is_active = 1
         ORDER BY created_at ASC`,
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async listStale(thresholdMs: number): Promise<AtcShardRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcShardRuntimeRow[]>(
        `SELECT id, shard_id, shard_type, region_id, owner_server_id,
                capacity_limit, current_load, is_active, transferred_at, created_at, updated_at
         FROM atc_shard_runtime
         WHERE is_active = 1
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)
         ORDER BY updated_at ASC`,
        [thresholdMs],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async deactivate(shardId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_shard_runtime
         SET is_active = 0, updated_at = NOW(3)
         WHERE shard_id = ?`,
        [shardId],
      )
    } finally {
      conn.release()
    }
  }
}
