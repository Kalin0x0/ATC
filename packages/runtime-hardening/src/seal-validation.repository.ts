import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeHardeningPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateSealValidationError, SealValidationNotFoundError } from './errors.js'

export type AtcSealValidationType = 'hash' | 'merkle' | 'signature' | 'epoch' | 'custom'
export type AtcSealValidationStatus = 'pending' | 'verifying' | 'verified' | 'broken' | 'failed'

export interface AtcSealValidation {
  id: string
  sealValidationId: string
  sealType: AtcSealValidationType
  status: AtcSealValidationStatus
  ownerServerId: string
  sealValidationNonce: string
  resourceId: string
  sealData: Record<string, unknown>
  verifiedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateSealValidationParams {
  sealType: AtcSealValidationType
  ownerServerId: string
  sealValidationNonce: string
  resourceId: string
  sealData?: Record<string, unknown> | undefined
}

interface SealValidationRow extends RowDataPacket {
  id: string
  seal_validation_id: string
  seal_type: string
  status: string
  owner_server_id: string
  seal_validation_nonce: string
  resource_id: string
  seal_data: string | null
  verified_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: SealValidationRow): AtcSealValidation {
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
    sealValidationId: row.seal_validation_id,
    sealType: row.seal_type as AtcSealValidationType,
    status: row.status as AtcSealValidationStatus,
    ownerServerId: row.owner_server_id,
    sealValidationNonce: row.seal_validation_nonce,
    resourceId: row.resource_id,
    sealData,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SealValidationRepository {
  constructor(private readonly pool: RuntimeHardeningPool) {}

  async create(params: CreateSealValidationParams): Promise<AtcSealValidation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const sealValidationId = generateId()
      const sealDataJson = JSON.stringify(params.sealData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_seal_validation
             (id, seal_validation_id, seal_type, status, owner_server_id, seal_validation_nonce,
              resource_id, seal_data, verified_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            sealValidationId,
            params.sealType,
            params.ownerServerId,
            params.sealValidationNonce,
            params.resourceId,
            sealDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateSealValidationError(params.sealValidationNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<SealValidationRow[]>(
        `SELECT id, seal_validation_id, seal_type, status, owner_server_id, seal_validation_nonce,
                resource_id, seal_data, verified_at, created_at, updated_at
         FROM atc_runtime_seal_validation
         WHERE id = ?
         LIMIT 1`,
        [id] as (string | number | boolean | null)[]
      )
      const row = rows[0]
      if (!row) throw new Error(`Seal validation record not found after insert: ${id}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcSealValidation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SealValidationRow[]>(
        `SELECT id, seal_validation_id, seal_type, status, owner_server_id, seal_validation_nonce,
                resource_id, seal_data, verified_at, created_at, updated_at
         FROM atc_runtime_seal_validation
         WHERE id = ?
         LIMIT 1`,
        [id] as (string | number | boolean | null)[]
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
    status: AtcSealValidationStatus,
    verifiedAt?: Date | undefined
  ): Promise<AtcSealValidation> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<SealValidationRow[]>(
          `SELECT id, seal_validation_id, seal_type, status, owner_server_id, seal_validation_nonce,
                  resource_id, seal_data, verified_at, created_at, updated_at
           FROM atc_runtime_seal_validation
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as (string | number | boolean | null)[]
        )
        const lockRow = lockRows[0]
        if (!lockRow) throw new SealValidationNotFoundError(id)

        if (verifiedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_seal_validation
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
            `UPDATE atc_runtime_seal_validation
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<SealValidationRow[]>(
          `SELECT id, seal_validation_id, seal_type, status, owner_server_id, seal_validation_nonce,
                  resource_id, seal_data, verified_at, created_at, updated_at
           FROM atc_runtime_seal_validation
           WHERE id = ?
           LIMIT 1`,
          [id] as (string | number | boolean | null)[]
        )
        const row = rows[0]
        if (!row) throw new SealValidationNotFoundError(id)

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
        `DELETE FROM atc_runtime_seal_validation
         WHERE status IN ('verified', 'broken', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as (string | number | boolean | null)[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
