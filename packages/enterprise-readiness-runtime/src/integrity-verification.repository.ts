import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EnterpriseReadinessPool } from './pool.js'
import { generateId } from './id.js'
import { IntegrityVerificationNotFoundError, DuplicateIntegrityVerificationError } from './errors.js'

export type AtcIntegrityVerificationType = 'hash' | 'signature' | 'merkle' | 'consensus' | 'custom'
export type AtcIntegrityVerificationStatus = 'pending' | 'verifying' | 'verified' | 'failed' | 'corrupted'

export interface AtcIntegrityVerification {
  id: string
  verificationId: string
  verificationType: AtcIntegrityVerificationType
  status: AtcIntegrityVerificationStatus
  ownerServerId: string
  verificationNonce: string
  verificationData: Record<string, unknown>
  verifiedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateIntegrityVerificationParams {
  verificationType: AtcIntegrityVerificationType
  ownerServerId: string
  verificationNonce: string
  verificationData?: Record<string, unknown> | undefined
}

interface IntegrityVerificationRow extends RowDataPacket {
  id: string
  verification_id: string
  verification_type: string
  status: string
  owner_server_id: string
  verification_nonce: string
  verification_data: string | null
  verified_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: IntegrityVerificationRow): AtcIntegrityVerification {
  let verificationData: Record<string, unknown> = {}
  if (row.verification_data) {
    try {
      verificationData = JSON.parse(row.verification_data) as Record<string, unknown>
    } catch {
      verificationData = {}
    }
  }
  return {
    id: row.id,
    verificationId: row.verification_id,
    verificationType: row.verification_type as AtcIntegrityVerificationType,
    status: row.status as AtcIntegrityVerificationStatus,
    ownerServerId: row.owner_server_id,
    verificationNonce: row.verification_nonce,
    verificationData,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class IntegrityVerificationRepository {
  constructor(private readonly pool: EnterpriseReadinessPool) {}

  async create(params: CreateIntegrityVerificationParams): Promise<AtcIntegrityVerification> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const verificationId = generateId()
      const verificationDataJson = JSON.stringify(params.verificationData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_integrity_verification
             (id, verification_id, verification_type, status, owner_server_id,
              verification_nonce, verification_data, verified_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            verificationId,
            params.verificationType,
            params.ownerServerId,
            params.verificationNonce,
            verificationDataJson,
          ] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateIntegrityVerificationError(params.verificationNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<IntegrityVerificationRow[]>(
        `SELECT id, verification_id, verification_type, status, owner_server_id,
                verification_nonce, verification_data, verified_at, created_at, updated_at
         FROM atc_runtime_integrity_verification
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) throw new Error(`Integrity verification not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcIntegrityVerification | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<IntegrityVerificationRow[]>(
        `SELECT id, verification_id, verification_type, status, owner_server_id,
                verification_nonce, verification_data, verified_at, created_at, updated_at
         FROM atc_runtime_integrity_verification
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
    status: AtcIntegrityVerificationStatus,
    verifiedAt?: Date | undefined
  ): Promise<AtcIntegrityVerification> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<IntegrityVerificationRow[]>(
          `SELECT id, verification_id, verification_type, status, owner_server_id,
                  verification_nonce, verification_data, verified_at, created_at, updated_at
           FROM atc_runtime_integrity_verification
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as unknown[]
        )
        if (!lockRows[0]) throw new IntegrityVerificationNotFoundError(id)

        if (verifiedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_integrity_verification
             SET status = ?, verified_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, verifiedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_integrity_verification
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as unknown[]
          )
        }

        const [rows] = await conn.execute<IntegrityVerificationRow[]>(
          `SELECT id, verification_id, verification_type, status, owner_server_id,
                  verification_nonce, verification_data, verified_at, created_at, updated_at
           FROM atc_runtime_integrity_verification
           WHERE id = ?
           LIMIT 1`,
          [id] as unknown[]
        )
        if (!rows[0]) throw new IntegrityVerificationNotFoundError(id)

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
        `DELETE FROM atc_runtime_integrity_verification
         WHERE status IN ('failed', 'corrupted')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
