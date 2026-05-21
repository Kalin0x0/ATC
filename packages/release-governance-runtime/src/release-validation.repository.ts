import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReleaseGovernancePool } from './pool.js'
import { generateId } from './id.js'
import { ReleaseValidationNotFoundError, DuplicateReleaseValidationError } from './errors.js'

export type AtcReleaseValidationType = 'smoke' | 'integration' | 'regression' | 'acceptance' | 'custom'
export type AtcReleaseValidationStatus = 'pending' | 'validating' | 'passed' | 'failed' | 'expired'

export interface AtcReleaseValidation {
  id: string
  validationId: string
  validationType: AtcReleaseValidationType
  status: AtcReleaseValidationStatus
  ownerServerId: string
  validationNonce: string
  validationData: Record<string, unknown>
  validatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateReleaseValidationParams {
  validationType: AtcReleaseValidationType
  ownerServerId: string
  validationNonce: string
  validationData?: Record<string, unknown> | undefined
}

interface ReleaseValidationRow extends RowDataPacket {
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

function mapRow(row: ReleaseValidationRow): AtcReleaseValidation {
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
    validationType: row.validation_type as AtcReleaseValidationType,
    status: row.status as AtcReleaseValidationStatus,
    ownerServerId: row.owner_server_id,
    validationNonce: row.validation_nonce,
    validationData,
    validatedAt: row.validated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ReleaseValidationRepository {
  constructor(private readonly pool: ReleaseGovernancePool) {}

  async create(params: CreateReleaseValidationParams): Promise<AtcReleaseValidation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const validationId = generateId()
      const validationDataJson = JSON.stringify(params.validationData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_release_validation
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
          throw new DuplicateReleaseValidationError(params.validationNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<ReleaseValidationRow[]>(
        `SELECT id, validation_id, validation_type, status, owner_server_id,
                validation_nonce, validation_data, validated_at, created_at, updated_at
         FROM atc_runtime_release_validation
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) throw new Error(`Release validation not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcReleaseValidation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ReleaseValidationRow[]>(
        `SELECT id, validation_id, validation_type, status, owner_server_id,
                validation_nonce, validation_data, validated_at, created_at, updated_at
         FROM atc_runtime_release_validation
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
    status: AtcReleaseValidationStatus,
    validatedAt?: Date | undefined
  ): Promise<AtcReleaseValidation> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ReleaseValidationRow[]>(
          `SELECT id, validation_id, validation_type, status, owner_server_id,
                  validation_nonce, validation_data, validated_at, created_at, updated_at
           FROM atc_runtime_release_validation
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as unknown[]
        )
        if (!lockRows[0]) throw new ReleaseValidationNotFoundError(id)

        if (validatedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_release_validation
             SET status = ?, validated_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, validatedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_release_validation
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as unknown[]
          )
        }

        const [rows] = await conn.execute<ReleaseValidationRow[]>(
          `SELECT id, validation_id, validation_type, status, owner_server_id,
                  validation_nonce, validation_data, validated_at, created_at, updated_at
           FROM atc_runtime_release_validation
           WHERE id = ?
           LIMIT 1`,
          [id] as unknown[]
        )
        if (!rows[0]) throw new ReleaseValidationNotFoundError(id)

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
        `DELETE FROM atc_runtime_release_validation
         WHERE status IN ('failed', 'expired')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
