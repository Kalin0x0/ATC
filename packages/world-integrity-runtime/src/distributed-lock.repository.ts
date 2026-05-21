import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { WorldIntegrityPool } from './pool.js'
import { generateId } from './id.js'
import { LockNotFoundError } from './errors.js'

export type AtcLockType = 'exclusive' | 'shared' | 'advisory' | 'intent' | 'custom'
export type AtcLockStatus = 'acquired' | 'released' | 'expired' | 'contested'

export interface AtcDistributedLock {
  id: string
  resourceKey: string
  lockType: AtcLockType
  status: AtcLockStatus
  ownerServerId: string
  lockNonce: string
  expiresAt: Date | null
  lockData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface UpsertLockParams {
  resourceKey: string
  lockType: AtcLockType
  ownerServerId: string
  lockNonce: string
  expiresAt?: Date | null | undefined
  lockData?: Record<string, unknown> | undefined
}

interface DistributedLockRow extends RowDataPacket {
  id: string
  resource_key: string
  lock_type: string
  status: string
  owner_server_id: string
  lock_nonce: string
  expires_at: Date | null
  lock_data: string | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: DistributedLockRow): AtcDistributedLock {
  let lockData: Record<string, unknown> = {}
  if (row.lock_data) {
    try {
      lockData = JSON.parse(row.lock_data) as Record<string, unknown>
    } catch {
      lockData = {}
    }
  }
  return {
    id: row.id,
    resourceKey: row.resource_key,
    lockType: row.lock_type as AtcLockType,
    status: row.status as AtcLockStatus,
    ownerServerId: row.owner_server_id,
    lockNonce: row.lock_nonce,
    expiresAt: row.expires_at,
    lockData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class DistributedLockRepository {
  constructor(private readonly pool: WorldIntegrityPool) {}

  async upsert(params: UpsertLockParams): Promise<AtcDistributedLock> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const lockDataJson = JSON.stringify(params.lockData ?? {})
      const expiresAt = params.expiresAt != null
        ? params.expiresAt.toISOString().replace('T', ' ').replace('Z', '')
        : null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_distributed_locks
           (id, resource_key, lock_type, status, owner_server_id, lock_nonce,
            expires_at, lock_data, created_at, updated_at)
         VALUES (?, ?, ?, 'acquired', ?, ?, ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           lock_type = VALUES(lock_type),
           status = 'acquired',
           owner_server_id = VALUES(owner_server_id),
           expires_at = VALUES(expires_at),
           lock_data = VALUES(lock_data),
           updated_at = NOW(3)`,
        [
          id,
          params.resourceKey,
          params.lockType,
          params.ownerServerId,
          params.lockNonce,
          expiresAt,
          lockDataJson,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<DistributedLockRow[]>(
        `SELECT id, resource_key, lock_type, status, owner_server_id, lock_nonce,
                expires_at, lock_data, created_at, updated_at
         FROM atc_distributed_locks
         WHERE resource_key = ?
         LIMIT 1`,
        [params.resourceKey]
      )
      if (!rows[0]) throw new Error(`Distributed lock not found after upsert: ${params.resourceKey}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByResourceKey(resourceKey: string): Promise<AtcDistributedLock | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DistributedLockRow[]>(
        `SELECT id, resource_key, lock_type, status, owner_server_id, lock_nonce,
                expires_at, lock_data, created_at, updated_at
         FROM atc_distributed_locks
         WHERE resource_key = ?
         LIMIT 1`,
        [resourceKey]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async releaseLock(resourceKey: string): Promise<AtcDistributedLock> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<DistributedLockRow[]>(
          `SELECT id, resource_key, lock_type, status, owner_server_id, lock_nonce,
                  expires_at, lock_data, created_at, updated_at
           FROM atc_distributed_locks
           WHERE resource_key = ?
           LIMIT 1
           FOR UPDATE`,
          [resourceKey]
        )
        if (!lockRows[0]) throw new LockNotFoundError(resourceKey)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_distributed_locks
           SET status = 'released', updated_at = NOW(3)
           WHERE resource_key = ?`,
          [resourceKey] as (string | number | boolean | null)[]
        )

        const [rows] = await conn.execute<DistributedLockRow[]>(
          `SELECT id, resource_key, lock_type, status, owner_server_id, lock_nonce,
                  expires_at, lock_data, created_at, updated_at
           FROM atc_distributed_locks
           WHERE resource_key = ?
           LIMIT 1`,
          [resourceKey]
        )
        if (!rows[0]) throw new LockNotFoundError(resourceKey)

        await conn.commit()
        return mapRow(rows[0])
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_distributed_locks
         WHERE status IN ('released', 'expired')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
