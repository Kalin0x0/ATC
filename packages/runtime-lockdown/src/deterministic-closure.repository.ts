import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeLockdownPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateClosureError, ClosureNotFoundError } from './errors.js'

export type AtcClosureType = 'graceful' | 'forced' | 'scheduled' | 'emergency' | 'custom'
export type AtcClosureStatus = 'pending' | 'in_progress' | 'completed' | 'aborted'

export interface AtcDeterministicClosure {
  id: string
  closureId: string
  closureType: AtcClosureType
  status: AtcClosureStatus
  ownerServerId: string
  closureNonce: string
  closureData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateClosureParams {
  closureType: AtcClosureType
  ownerServerId: string
  closureNonce: string
  closureData?: Record<string, unknown> | undefined
}

interface DeterministicClosureRow extends RowDataPacket {
  id: string
  closure_id: string
  closure_type: string
  status: string
  owner_server_id: string
  closure_nonce: string
  closure_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: DeterministicClosureRow): AtcDeterministicClosure {
  let closureData: Record<string, unknown> = {}
  if (row.closure_data) {
    try {
      closureData = JSON.parse(row.closure_data) as Record<string, unknown>
    } catch {
      closureData = {}
    }
  }
  return {
    id: row.id,
    closureId: row.closure_id,
    closureType: row.closure_type as AtcClosureType,
    status: row.status as AtcClosureStatus,
    ownerServerId: row.owner_server_id,
    closureNonce: row.closure_nonce,
    closureData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class DeterministicClosureRepository {
  constructor(private readonly pool: RuntimeLockdownPool) {}

  async create(params: CreateClosureParams): Promise<AtcDeterministicClosure> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const closureId = generateId()
      const closureDataJson = JSON.stringify(params.closureData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_lockdown_recovery
             (id, closure_id, closure_type, status, owner_server_id, closure_nonce,
              closure_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            closureId,
            params.closureType,
            params.ownerServerId,
            params.closureNonce,
            closureDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateClosureError(params.closureNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<DeterministicClosureRow[]>(
        `SELECT id, closure_id, closure_type, status, owner_server_id, closure_nonce,
                closure_data, completed_at, created_at, updated_at
         FROM atc_lockdown_recovery
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      const row = rows[0]
      if (!row) throw new Error(`Deterministic closure record not found after insert: ${id}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcDeterministicClosure | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DeterministicClosureRow[]>(
        `SELECT id, closure_id, closure_type, status, owner_server_id, closure_nonce,
                closure_data, completed_at, created_at, updated_at
         FROM atc_lockdown_recovery
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
    status: AtcClosureStatus,
    completedAt?: Date | undefined
  ): Promise<AtcDeterministicClosure> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<DeterministicClosureRow[]>(
          `SELECT id, closure_id, closure_type, status, owner_server_id, closure_nonce,
                  closure_data, completed_at, created_at, updated_at
           FROM atc_lockdown_recovery
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        const lockRow = lockRows[0]
        if (!lockRow) throw new ClosureNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_lockdown_recovery
             SET status = ?, completed_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              completedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_lockdown_recovery
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<DeterministicClosureRow[]>(
          `SELECT id, closure_id, closure_type, status, owner_server_id, closure_nonce,
                  closure_data, completed_at, created_at, updated_at
           FROM atc_lockdown_recovery
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        const row = rows[0]
        if (!row) throw new ClosureNotFoundError(id)

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
        `DELETE FROM atc_lockdown_recovery
         WHERE status IN ('completed', 'aborted')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
