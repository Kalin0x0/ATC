import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeSustainmentPool } from './pool.js'
import { generateId } from './id.js'
import { LongevityNotFoundError, DuplicateLongevityError } from './errors.js'

export type AtcLongevityType = 'checkpoint' | 'snapshot' | 'archive' | 'milestone' | 'custom'
export type AtcLongevityStatus = 'pending' | 'active' | 'archived' | 'expired' | 'failed'

export interface AtcRuntimeLongevity {
  id: string
  longevityId: string
  longevityType: AtcLongevityType
  status: AtcLongevityStatus
  ownerServerId: string
  longevityNonce: string
  longevityData: Record<string, unknown>
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateLongevityParams {
  longevityType: AtcLongevityType
  ownerServerId: string
  longevityNonce: string
  longevityData?: Record<string, unknown> | undefined
}

interface RuntimeLongevityRow extends RowDataPacket {
  id: string
  longevity_id: string
  longevity_type: string
  status: string
  owner_server_id: string
  longevity_nonce: string
  longevity_data: string | null
  archived_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeLongevityRow): AtcRuntimeLongevity {
  let longevityData: Record<string, unknown> = {}
  if (row.longevity_data) {
    try {
      longevityData = JSON.parse(row.longevity_data) as Record<string, unknown>
    } catch {
      longevityData = {}
    }
  }
  return {
    id: row.id,
    longevityId: row.longevity_id,
    longevityType: row.longevity_type as AtcLongevityType,
    status: row.status as AtcLongevityStatus,
    ownerServerId: row.owner_server_id,
    longevityNonce: row.longevity_nonce,
    longevityData,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeLongevityRepository {
  constructor(private readonly pool: RuntimeSustainmentPool) {}

  async create(params: CreateLongevityParams): Promise<AtcRuntimeLongevity> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const longevityId = generateId()
      const longevityDataJson = JSON.stringify(params.longevityData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_longevity
             (id, longevity_id, longevity_type, status, owner_server_id,
              longevity_nonce, longevity_data, archived_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            longevityId,
            params.longevityType,
            params.ownerServerId,
            params.longevityNonce,
            longevityDataJson,
          ] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateLongevityError(params.longevityNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<RuntimeLongevityRow[]>(
        `SELECT id, longevity_id, longevity_type, status, owner_server_id,
                longevity_nonce, longevity_data, archived_at, created_at, updated_at
         FROM atc_runtime_longevity
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) throw new Error(`Runtime longevity not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeLongevity | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeLongevityRow[]>(
        `SELECT id, longevity_id, longevity_type, status, owner_server_id,
                longevity_nonce, longevity_data, archived_at, created_at, updated_at
         FROM atc_runtime_longevity
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
    status: AtcLongevityStatus,
    archivedAt?: Date | undefined
  ): Promise<AtcRuntimeLongevity> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeLongevityRow[]>(
          `SELECT id, longevity_id, longevity_type, status, owner_server_id,
                  longevity_nonce, longevity_data, archived_at, created_at, updated_at
           FROM atc_runtime_longevity
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as unknown[]
        )
        if (!lockRows[0]) throw new LongevityNotFoundError(id)

        if (archivedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_longevity
             SET status = ?, archived_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, archivedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_longevity
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as unknown[]
          )
        }

        const [rows] = await conn.execute<RuntimeLongevityRow[]>(
          `SELECT id, longevity_id, longevity_type, status, owner_server_id,
                  longevity_nonce, longevity_data, archived_at, created_at, updated_at
           FROM atc_runtime_longevity
           WHERE id = ?
           LIMIT 1`,
          [id] as unknown[]
        )
        if (!rows[0]) throw new LongevityNotFoundError(id)

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
        `DELETE FROM atc_runtime_longevity
         WHERE status IN ('archived', 'expired', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
