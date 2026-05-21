import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeCertificationPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateVerificationError, VerificationNotFoundError } from './errors.js'

export type AtcVerificationType = 'signature' | 'hash' | 'proof' | 'attestation' | 'audit' | 'custom'
export type AtcVerificationStatus = 'pending' | 'verifying' | 'verified' | 'failed' | 'expired'

export interface AtcVerificationRuntime {
  id: string
  verificationId: string
  verificationType: AtcVerificationType
  status: AtcVerificationStatus
  ownerServerId: string
  verificationNonce: string
  verificationData: Record<string, unknown>
  verifiedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateVerificationParams {
  verificationType: AtcVerificationType
  ownerServerId: string
  verificationNonce: string
  verificationData?: Record<string, unknown> | undefined
}

interface VerificationRuntimeRow extends RowDataPacket {
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

function mapRow(row: VerificationRuntimeRow): AtcVerificationRuntime {
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
    verificationType: row.verification_type as AtcVerificationType,
    status: row.status as AtcVerificationStatus,
    ownerServerId: row.owner_server_id,
    verificationNonce: row.verification_nonce,
    verificationData,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class VerificationRuntimeRepository {
  constructor(private readonly pool: RuntimeCertificationPool) {}

  async create(params: CreateVerificationParams): Promise<AtcVerificationRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const verificationId = generateId()
      const verificationDataJson = JSON.stringify(params.verificationData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_verification_runtime
             (id, verification_id, verification_type, status, owner_server_id, verification_nonce,
              verification_data, verified_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            verificationId,
            params.verificationType,
            params.ownerServerId,
            params.verificationNonce,
            verificationDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateVerificationError(params.verificationNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<VerificationRuntimeRow[]>(
        `SELECT id, verification_id, verification_type, status, owner_server_id, verification_nonce,
                verification_data, verified_at, created_at, updated_at
         FROM atc_verification_runtime
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Verification runtime record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcVerificationRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<VerificationRuntimeRow[]>(
        `SELECT id, verification_id, verification_type, status, owner_server_id, verification_nonce,
                verification_data, verified_at, created_at, updated_at
         FROM atc_verification_runtime
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
    status: AtcVerificationStatus,
    verifiedAt?: Date | undefined
  ): Promise<AtcVerificationRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<VerificationRuntimeRow[]>(
          `SELECT id, verification_id, verification_type, status, owner_server_id, verification_nonce,
                  verification_data, verified_at, created_at, updated_at
           FROM atc_verification_runtime
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new VerificationNotFoundError(id)

        if (verifiedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_verification_runtime
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
            `UPDATE atc_verification_runtime
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<VerificationRuntimeRow[]>(
          `SELECT id, verification_id, verification_type, status, owner_server_id, verification_nonce,
                  verification_data, verified_at, created_at, updated_at
           FROM atc_verification_runtime
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new VerificationNotFoundError(id)

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
        `DELETE FROM atc_verification_runtime
         WHERE status IN ('verified', 'failed', 'expired')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
