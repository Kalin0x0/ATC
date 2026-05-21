import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { CoreClosurePool } from './pool.js'
import { generateId } from './id.js'
import { FinalValidationNotFoundError, DuplicateFinalValidationError } from './errors.js'

export type AtcFinalValidationType = 'deterministic' | 'consensus' | 'hash' | 'signature' | 'custom'
export type AtcFinalValidationStatus = 'pending' | 'validating' | 'completed' | 'failed'

export interface AtcFinalValidation {
  id: string
  validationId: string
  validationType: AtcFinalValidationType
  status: AtcFinalValidationStatus
  ownerServerId: string
  validationNonce: string
  validationData: Record<string, unknown>
  validatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateFinalValidationParams {
  validationType: AtcFinalValidationType
  ownerServerId: string
  validationNonce: string
  validationData?: Record<string, unknown> | undefined
}

interface FinalValidationRow extends RowDataPacket {
  id: string
  validation_id: string
  validation_type: string
  status: string
  owner_server_id: string
  validation_nonce: string
  validation_data: string | null
  validated_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: FinalValidationRow): AtcFinalValidation {
  let validationData: Record<string, unknown> = {}
  if (row.validation_data) {
    try {
      validationData = JSON.parse(row.validation_data) as Record<string, unknown>
    } catch {
      validationData = {}
    }
  }
  return {
    id: row.id,
    validationId: row.validation_id,
    validationType: row.validation_type as AtcFinalValidationType,
    status: row.status as AtcFinalValidationStatus,
    ownerServerId: row.owner_server_id,
    validationNonce: row.validation_nonce,
    validationData,
    validatedAt: row.validated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class FinalValidationRepository {
  constructor(private readonly pool: CoreClosurePool) {}

  async create(params: CreateFinalValidationParams): Promise<AtcFinalValidation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const validationId = generateId()
      const validationDataJson = JSON.stringify(params.validationData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_final_validation
             (id, validation_id, validation_type, status, owner_server_id,
              validation_nonce, validation_data, validated_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            validationId,
            params.validationType,
            params.ownerServerId,
            params.validationNonce,
            validationDataJson,
          ] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateFinalValidationError(params.validationNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<FinalValidationRow[]>(
        `SELECT id, validation_id, validation_type, status, owner_server_id,
                validation_nonce, validation_data, validated_at, created_at, updated_at
         FROM atc_final_validation
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) throw new Error(`Final validation not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcFinalValidation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FinalValidationRow[]>(
        `SELECT id, validation_id, validation_type, status, owner_server_id,
                validation_nonce, validation_data, validated_at, created_at, updated_at
         FROM atc_final_validation
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
    status: AtcFinalValidationStatus,
    validatedAt?: Date | undefined
  ): Promise<AtcFinalValidation> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<FinalValidationRow[]>(
          `SELECT id, validation_id, validation_type, status, owner_server_id,
                  validation_nonce, validation_data, validated_at, created_at, updated_at
           FROM atc_final_validation
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as unknown[]
        )
        if (!lockRows[0]) throw new FinalValidationNotFoundError(id)

        if (validatedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_final_validation
             SET status = ?, validated_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, validatedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_final_validation
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as unknown[]
          )
        }

        const [rows] = await conn.execute<FinalValidationRow[]>(
          `SELECT id, validation_id, validation_type, status, owner_server_id,
                  validation_nonce, validation_data, validated_at, created_at, updated_at
           FROM atc_final_validation
           WHERE id = ?
           LIMIT 1`,
          [id] as unknown[]
        )
        if (!rows[0]) throw new FinalValidationNotFoundError(id)

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
        `DELETE FROM atc_final_validation
         WHERE status IN ('failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
