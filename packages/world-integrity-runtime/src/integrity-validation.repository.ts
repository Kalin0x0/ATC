import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { WorldIntegrityPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateValidationError, ValidationNotFoundError } from './errors.js'

export type AtcValidationType = 'world_state' | 'entity_state' | 'transaction' | 'replication' | 'custom'
export type AtcValidationStatus = 'pending' | 'passed' | 'failed' | 'skipped'

export interface AtcIntegrityValidation {
  id: string
  validationId: string
  validationType: AtcValidationType
  status: AtcValidationStatus
  ownerServerId: string
  targetId: string | null
  validationNonce: string
  validationData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateValidationParams {
  validationType: AtcValidationType
  ownerServerId: string
  targetId?: string | undefined
  validationNonce: string
  validationData?: Record<string, unknown> | undefined
}

interface IntegrityValidationRow extends RowDataPacket {
  id: string
  validation_id: string
  validation_type: string
  status: string
  owner_server_id: string
  target_id: string | null
  validation_nonce: string
  validation_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: IntegrityValidationRow): AtcIntegrityValidation {
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
    validationType: row.validation_type as AtcValidationType,
    status: row.status as AtcValidationStatus,
    ownerServerId: row.owner_server_id,
    targetId: row.target_id,
    validationNonce: row.validation_nonce,
    validationData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class IntegrityValidationRepository {
  constructor(private readonly pool: WorldIntegrityPool) {}

  async create(params: CreateValidationParams): Promise<AtcIntegrityValidation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const validationId = generateId()
      const validationDataJson = JSON.stringify(params.validationData ?? {})
      const targetId = params.targetId ?? null

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_integrity_validation
             (id, validation_id, validation_type, status, owner_server_id, target_id,
              validation_nonce, validation_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            validationId,
            params.validationType,
            params.ownerServerId,
            targetId,
            params.validationNonce,
            validationDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateValidationError(params.validationNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<IntegrityValidationRow[]>(
        `SELECT id, validation_id, validation_type, status, owner_server_id, target_id,
                validation_nonce, validation_data, completed_at, created_at, updated_at
         FROM atc_integrity_validation
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Integrity validation record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcIntegrityValidation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<IntegrityValidationRow[]>(
        `SELECT id, validation_id, validation_type, status, owner_server_id, target_id,
                validation_nonce, validation_data, completed_at, created_at, updated_at
         FROM atc_integrity_validation
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

  async findByValidationId(validationId: string): Promise<AtcIntegrityValidation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<IntegrityValidationRow[]>(
        `SELECT id, validation_id, validation_type, status, owner_server_id, target_id,
                validation_nonce, validation_data, completed_at, created_at, updated_at
         FROM atc_integrity_validation
         WHERE validation_id = ?
         LIMIT 1`,
        [validationId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcValidationStatus,
    completedAt?: Date | undefined
  ): Promise<AtcIntegrityValidation> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<IntegrityValidationRow[]>(
          `SELECT id, validation_id, validation_type, status, owner_server_id, target_id,
                  validation_nonce, validation_data, completed_at, created_at, updated_at
           FROM atc_integrity_validation
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new ValidationNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_integrity_validation
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
            `UPDATE atc_integrity_validation
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<IntegrityValidationRow[]>(
          `SELECT id, validation_id, validation_type, status, owner_server_id, target_id,
                  validation_nonce, validation_data, completed_at, created_at, updated_at
           FROM atc_integrity_validation
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new ValidationNotFoundError(id)

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
        `DELETE FROM atc_integrity_validation
         WHERE status IN ('passed', 'failed', 'skipped')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
