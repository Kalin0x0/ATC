import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ContinuityRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateContinuityError, ContinuityNotFoundError } from './errors.js'

export type AtcContinuityType = 'session' | 'entity' | 'world' | 'system' | 'custom'
export type AtcContinuityStatus = 'active' | 'suspended' | 'terminated' | 'failed'

export interface AtcRuntimeContinuity {
  id: string
  continuityId: string
  continuityType: AtcContinuityType
  status: AtcContinuityStatus
  ownerServerId: string
  continuityNonce: string
  continuityData: Record<string, unknown>
  terminatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateContinuityParams {
  continuityType: AtcContinuityType
  ownerServerId: string
  continuityNonce: string
  continuityData?: Record<string, unknown> | undefined
}

interface RuntimeContinuityRow extends RowDataPacket {
  id: string
  continuity_id: string
  continuity_type: string
  status: string
  owner_server_id: string
  continuity_nonce: string
  continuity_data: string | null
  terminated_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeContinuityRow): AtcRuntimeContinuity {
  let continuityData: Record<string, unknown> = {}
  if (row.continuity_data) {
    try {
      continuityData = JSON.parse(row.continuity_data) as Record<string, unknown>
    } catch {
      continuityData = {}
    }
  }
  return {
    id: row.id,
    continuityId: row.continuity_id,
    continuityType: row.continuity_type as AtcContinuityType,
    status: row.status as AtcContinuityStatus,
    ownerServerId: row.owner_server_id,
    continuityNonce: row.continuity_nonce,
    continuityData,
    terminatedAt: row.terminated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ContinuityRuntimeRepository {
  constructor(private readonly pool: ContinuityRuntimePool) {}

  async create(params: CreateContinuityParams): Promise<AtcRuntimeContinuity> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const continuityId = generateId()
      const continuityDataJson = JSON.stringify(params.continuityData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_continuity
             (id, continuity_id, continuity_type, status, owner_server_id, continuity_nonce,
              continuity_data, terminated_at, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            continuityId,
            params.continuityType,
            params.ownerServerId,
            params.continuityNonce,
            continuityDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateContinuityError(params.continuityNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<RuntimeContinuityRow[]>(
        `SELECT id, continuity_id, continuity_type, status, owner_server_id, continuity_nonce,
                continuity_data, terminated_at, created_at, updated_at
         FROM atc_runtime_continuity
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Runtime continuity record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeContinuity | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeContinuityRow[]>(
        `SELECT id, continuity_id, continuity_type, status, owner_server_id, continuity_nonce,
                continuity_data, terminated_at, created_at, updated_at
         FROM atc_runtime_continuity
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcContinuityStatus,
    terminatedAt?: Date | undefined
  ): Promise<AtcRuntimeContinuity> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeContinuityRow[]>(
          `SELECT id, continuity_id, continuity_type, status, owner_server_id, continuity_nonce,
                  continuity_data, terminated_at, created_at, updated_at
           FROM atc_runtime_continuity
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new ContinuityNotFoundError(id)

        if (terminatedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_continuity
             SET status = ?, terminated_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              terminatedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_continuity
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<RuntimeContinuityRow[]>(
          `SELECT id, continuity_id, continuity_type, status, owner_server_id, continuity_nonce,
                  continuity_data, terminated_at, created_at, updated_at
           FROM atc_runtime_continuity
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new ContinuityNotFoundError(id)

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
        `DELETE FROM atc_runtime_continuity
         WHERE status IN ('terminated', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
