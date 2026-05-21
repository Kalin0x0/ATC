import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { CoreClosurePool } from './pool.js'
import { generateId } from './id.js'
import { CoreClosureNotFoundError, DuplicateCoreClosureError } from './errors.js'

export type AtcClosureType = 'final' | 'partial' | 'emergency' | 'scheduled' | 'custom'
export type AtcClosureStatus = 'pending' | 'active' | 'sealed' | 'failed'

export interface AtcCoreClosure {
  id: string
  closureId: string
  closureType: AtcClosureType
  status: AtcClosureStatus
  ownerServerId: string
  closureNonce: string
  closureData: Record<string, unknown>
  sealedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateCoreClosureParams {
  closureType: AtcClosureType
  ownerServerId: string
  closureNonce: string
  closureData?: Record<string, unknown> | undefined
}

interface CoreClosureRow extends RowDataPacket {
  id: string
  closure_id: string
  closure_type: string
  status: string
  owner_server_id: string
  closure_nonce: string
  closure_data: string | null
  sealed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: CoreClosureRow): AtcCoreClosure {
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
    sealedAt: row.sealed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class CoreClosureRepository {
  constructor(private readonly pool: CoreClosurePool) {}

  async create(params: CreateCoreClosureParams): Promise<AtcCoreClosure> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const closureId = generateId()
      const closureDataJson = JSON.stringify(params.closureData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_core_closure
             (id, closure_id, closure_type, status, owner_server_id,
              closure_nonce, closure_data, sealed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            closureId,
            params.closureType,
            params.ownerServerId,
            params.closureNonce,
            closureDataJson,
          ] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateCoreClosureError(params.closureNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<CoreClosureRow[]>(
        `SELECT id, closure_id, closure_type, status, owner_server_id,
                closure_nonce, closure_data, sealed_at, created_at, updated_at
         FROM atc_core_closure
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) throw new Error(`Core closure not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcCoreClosure | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CoreClosureRow[]>(
        `SELECT id, closure_id, closure_type, status, owner_server_id,
                closure_nonce, closure_data, sealed_at, created_at, updated_at
         FROM atc_core_closure
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcClosureStatus,
    sealedAt?: Date | undefined
  ): Promise<AtcCoreClosure> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<CoreClosureRow[]>(
          `SELECT id, closure_id, closure_type, status, owner_server_id,
                  closure_nonce, closure_data, sealed_at, created_at, updated_at
           FROM atc_core_closure
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as unknown[]
        )
        if (!lockRows[0]) throw new CoreClosureNotFoundError(id)

        if (sealedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_core_closure
             SET status = ?, sealed_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, sealedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_core_closure
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as unknown[]
          )
        }

        const [rows] = await conn.execute<CoreClosureRow[]>(
          `SELECT id, closure_id, closure_type, status, owner_server_id,
                  closure_nonce, closure_data, sealed_at, created_at, updated_at
           FROM atc_core_closure
           WHERE id = ?
           LIMIT 1`,
          [id] as unknown[]
        )
        if (!rows[0]) throw new CoreClosureNotFoundError(id)

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
        `DELETE FROM atc_core_closure
         WHERE status IN ('sealed', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
