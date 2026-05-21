import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeLockdownPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateLockdownError, LockdownNotFoundError } from './errors.js'

export type AtcLockdownType = 'partial' | 'full' | 'emergency' | 'maintenance' | 'custom'
export type AtcLockdownStatus = 'initiated' | 'active' | 'lifting' | 'lifted' | 'failed'

export interface AtcRuntimeLockdown {
  id: string
  lockdownId: string
  lockdownType: AtcLockdownType
  status: AtcLockdownStatus
  ownerServerId: string
  lockdownNonce: string
  lockdownData: Record<string, unknown>
  liftedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateLockdownParams {
  lockdownType: AtcLockdownType
  ownerServerId: string
  lockdownNonce: string
  lockdownData?: Record<string, unknown> | undefined
}

interface RuntimeLockdownRow extends RowDataPacket {
  id: string
  lockdown_id: string
  lockdown_type: string
  status: string
  owner_server_id: string
  lockdown_nonce: string
  lockdown_data: string | null
  lifted_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeLockdownRow): AtcRuntimeLockdown {
  let lockdownData: Record<string, unknown> = {}
  if (row.lockdown_data) {
    try {
      lockdownData = JSON.parse(row.lockdown_data) as Record<string, unknown>
    } catch {
      lockdownData = {}
    }
  }
  return {
    id: row.id,
    lockdownId: row.lockdown_id,
    lockdownType: row.lockdown_type as AtcLockdownType,
    status: row.status as AtcLockdownStatus,
    ownerServerId: row.owner_server_id,
    lockdownNonce: row.lockdown_nonce,
    lockdownData,
    liftedAt: row.lifted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeLockdownRepository {
  constructor(private readonly pool: RuntimeLockdownPool) {}

  async create(params: CreateLockdownParams): Promise<AtcRuntimeLockdown> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const lockdownId = generateId()
      const lockdownDataJson = JSON.stringify(params.lockdownData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_lockdown
             (id, lockdown_id, lockdown_type, status, owner_server_id, lockdown_nonce,
              lockdown_data, lifted_at, created_at, updated_at)
           VALUES (?, ?, ?, 'initiated', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            lockdownId,
            params.lockdownType,
            params.ownerServerId,
            params.lockdownNonce,
            lockdownDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateLockdownError(params.lockdownNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<RuntimeLockdownRow[]>(
        `SELECT id, lockdown_id, lockdown_type, status, owner_server_id, lockdown_nonce,
                lockdown_data, lifted_at, created_at, updated_at
         FROM atc_runtime_lockdown
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      const row = rows[0]
      if (!row) throw new Error(`Runtime lockdown record not found after insert: ${id}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeLockdown | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeLockdownRow[]>(
        `SELECT id, lockdown_id, lockdown_type, status, owner_server_id, lockdown_nonce,
                lockdown_data, lifted_at, created_at, updated_at
         FROM atc_runtime_lockdown
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcLockdownStatus,
    liftedAt?: Date | undefined
  ): Promise<AtcRuntimeLockdown> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeLockdownRow[]>(
          `SELECT id, lockdown_id, lockdown_type, status, owner_server_id, lockdown_nonce,
                  lockdown_data, lifted_at, created_at, updated_at
           FROM atc_runtime_lockdown
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        const lockRow = lockRows[0]
        if (!lockRow) throw new LockdownNotFoundError(id)

        if (liftedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_lockdown
             SET status = ?, lifted_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              liftedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_lockdown
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<RuntimeLockdownRow[]>(
          `SELECT id, lockdown_id, lockdown_type, status, owner_server_id, lockdown_nonce,
                  lockdown_data, lifted_at, created_at, updated_at
           FROM atc_runtime_lockdown
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        const row = rows[0]
        if (!row) throw new LockdownNotFoundError(id)

        await conn.commit()
        return mapRow(row)
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
        `DELETE FROM atc_runtime_lockdown
         WHERE status IN ('lifted', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
