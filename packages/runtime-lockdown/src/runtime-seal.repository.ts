import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeLockdownPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateLockdownError, SealNotFoundError } from './errors.js'

export type AtcSealType = 'immutable' | 'readonly' | 'checksum' | 'signature' | 'custom'
export type AtcSealStatus = 'applied' | 'verified' | 'broken' | 'expired'

export interface AtcRuntimeSeal {
  id: string
  sealId: string
  sealType: AtcSealType
  status: AtcSealStatus
  ownerServerId: string
  resourceId: string
  sealNonce: string
  sealData: Record<string, unknown>
  verifiedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateSealParams {
  sealType: AtcSealType
  ownerServerId: string
  resourceId: string
  sealNonce: string
  sealData?: Record<string, unknown> | undefined
}

interface RuntimeSealRow extends RowDataPacket {
  id: string
  seal_id: string
  seal_type: string
  status: string
  owner_server_id: string
  resource_id: string
  seal_nonce: string
  seal_data: string | null
  verified_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeSealRow): AtcRuntimeSeal {
  let sealData: Record<string, unknown> = {}
  if (row.seal_data) {
    try {
      sealData = JSON.parse(row.seal_data) as Record<string, unknown>
    } catch {
      sealData = {}
    }
  }
  return {
    id: row.id,
    sealId: row.seal_id,
    sealType: row.seal_type as AtcSealType,
    status: row.status as AtcSealStatus,
    ownerServerId: row.owner_server_id,
    resourceId: row.resource_id,
    sealNonce: row.seal_nonce,
    sealData,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeSealRepository {
  constructor(private readonly pool: RuntimeLockdownPool) {}

  async create(params: CreateSealParams): Promise<AtcRuntimeSeal> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const sealId = generateId()
      const sealDataJson = JSON.stringify(params.sealData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_seals
             (id, seal_id, seal_type, status, owner_server_id, resource_id, seal_nonce,
              seal_data, verified_at, created_at, updated_at)
           VALUES (?, ?, ?, 'applied', ?, ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            sealId,
            params.sealType,
            params.ownerServerId,
            params.resourceId,
            params.sealNonce,
            sealDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateLockdownError(params.sealNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<RuntimeSealRow[]>(
        `SELECT id, seal_id, seal_type, status, owner_server_id, resource_id, seal_nonce,
                seal_data, verified_at, created_at, updated_at
         FROM atc_runtime_seals
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      const row = rows[0]
      if (!row) throw new Error(`Runtime seal record not found after insert: ${id}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeSeal | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeSealRow[]>(
        `SELECT id, seal_id, seal_type, status, owner_server_id, resource_id, seal_nonce,
                seal_data, verified_at, created_at, updated_at
         FROM atc_runtime_seals
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
    status: AtcSealStatus,
    verifiedAt?: Date | undefined
  ): Promise<AtcRuntimeSeal> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeSealRow[]>(
          `SELECT id, seal_id, seal_type, status, owner_server_id, resource_id, seal_nonce,
                  seal_data, verified_at, created_at, updated_at
           FROM atc_runtime_seals
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        const lockRow = lockRows[0]
        if (!lockRow) throw new SealNotFoundError(id)

        if (verifiedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_seals
             SET status = ?, verified_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              verifiedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_seals
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<RuntimeSealRow[]>(
          `SELECT id, seal_id, seal_type, status, owner_server_id, resource_id, seal_nonce,
                  seal_data, verified_at, created_at, updated_at
           FROM atc_runtime_seals
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        const row = rows[0]
        if (!row) throw new SealNotFoundError(id)

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
        `DELETE FROM atc_runtime_seals
         WHERE status IN ('broken', 'expired')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
