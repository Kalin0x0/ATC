import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeHardeningPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateSecurityValidationError, SecurityValidationNotFoundError } from './errors.js'

export type AtcSecurityValidationType = 'signature' | 'hash' | 'certificate' | 'token' | 'custom'
export type AtcSecurityValidationStatus = 'pending' | 'validating' | 'passed' | 'failed' | 'expired'

export interface AtcSecurityValidation {
  id: string
  validationId: string
  validationType: AtcSecurityValidationType
  status: AtcSecurityValidationStatus
  ownerServerId: string
  validationNonce: string
  validationData: Record<string, unknown>
  validatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateSecurityValidationParams {
  validationType: AtcSecurityValidationType
  ownerServerId: string
  validationNonce: string
  validationData?: Record<string, unknown> | undefined
}

interface SecurityValidationRow extends RowDataPacket {
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

function mapRow(row: SecurityValidationRow): AtcSecurityValidation {
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
    validationType: row.validation_type as AtcSecurityValidationType,
    status: row.status as AtcSecurityValidationStatus,
    ownerServerId: row.owner_server_id,
    validationNonce: row.validation_nonce,
    validationData,
    validatedAt: row.validated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SecurityValidationRepository {
  constructor(private readonly pool: RuntimeHardeningPool) {}

  async create(params: CreateSecurityValidationParams): Promise<AtcSecurityValidation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const validationId = generateId()
      const validationDataJson = JSON.stringify(params.validationData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_security_validation
             (id, validation_id, validation_type, status, owner_server_id, validation_nonce,
              validation_data, validated_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            validationId,
            params.validationType,
            params.ownerServerId,
            params.validationNonce,
            validationDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateSecurityValidationError(params.validationNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<SecurityValidationRow[]>(
        `SELECT id, validation_id, validation_type, status, owner_server_id, validation_nonce,
                validation_data, validated_at, created_at, updated_at
         FROM atc_security_validation
         WHERE id = ?
         LIMIT 1`,
        [id] as (string | number | boolean | null)[]
      )
      const row = rows[0]
      if (!row) throw new Error(`Security validation record not found after insert: ${id}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcSecurityValidation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SecurityValidationRow[]>(
        `SELECT id, validation_id, validation_type, status, owner_server_id, validation_nonce,
                validation_data, validated_at, created_at, updated_at
         FROM atc_security_validation
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
    status: AtcSecurityValidationStatus,
    validatedAt?: Date | undefined
  ): Promise<AtcSecurityValidation> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<SecurityValidationRow[]>(
          `SELECT id, validation_id, validation_type, status, owner_server_id, validation_nonce,
                  validation_data, validated_at, created_at, updated_at
           FROM atc_security_validation
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as (string | number | boolean | null)[]
        )
        const lockRow = lockRows[0]
        if (!lockRow) throw new SecurityValidationNotFoundError(id)

        if (validatedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_security_validation
             SET status = ?, validated_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              validatedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_security_validation
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<SecurityValidationRow[]>(
          `SELECT id, validation_id, validation_type, status, owner_server_id, validation_nonce,
                  validation_data, validated_at, created_at, updated_at
           FROM atc_security_validation
           WHERE id = ?
           LIMIT 1`,
          [id] as (string | number | boolean | null)[]
        )
        const row = rows[0]
        if (!row) throw new SecurityValidationNotFoundError(id)

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
        `DELETE FROM atc_security_validation
         WHERE status IN ('passed', 'failed', 'expired')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as (string | number | boolean | null)[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
