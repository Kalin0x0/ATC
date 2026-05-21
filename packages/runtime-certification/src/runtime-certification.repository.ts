import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeCertificationPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateCertificationError, CertificationNotFoundError } from './errors.js'

export type AtcCertificationType = 'runtime' | 'compliance' | 'validation' | 'integrity' | 'performance' | 'custom'
export type AtcCertificationStatus = 'pending' | 'certified' | 'expired' | 'revoked' | 'failed'

export interface AtcRuntimeCertification {
  id: string
  certificationId: string
  certificationType: AtcCertificationType
  status: AtcCertificationStatus
  ownerServerId: string
  certificationNonce: string
  certificationData: Record<string, unknown>
  certifiedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateCertificationParams {
  certificationType: AtcCertificationType
  ownerServerId: string
  certificationNonce: string
  certificationData?: Record<string, unknown> | undefined
}

interface RuntimeCertificationRow extends RowDataPacket {
  id: string
  certification_id: string
  certification_type: string
  status: string
  owner_server_id: string
  certification_nonce: string
  certification_data: string | null
  certified_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeCertificationRow): AtcRuntimeCertification {
  let certificationData: Record<string, unknown> = {}
  if (row.certification_data) {
    try {
      certificationData = JSON.parse(row.certification_data) as Record<string, unknown>
    } catch {
      certificationData = {}
    }
  }
  return {
    id: row.id,
    certificationId: row.certification_id,
    certificationType: row.certification_type as AtcCertificationType,
    status: row.status as AtcCertificationStatus,
    ownerServerId: row.owner_server_id,
    certificationNonce: row.certification_nonce,
    certificationData,
    certifiedAt: row.certified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeCertificationRepository {
  constructor(private readonly pool: RuntimeCertificationPool) {}

  async create(params: CreateCertificationParams): Promise<AtcRuntimeCertification> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const certificationId = generateId()
      const certificationDataJson = JSON.stringify(params.certificationData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_certification
             (id, certification_id, certification_type, status, owner_server_id, certification_nonce,
              certification_data, certified_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            certificationId,
            params.certificationType,
            params.ownerServerId,
            params.certificationNonce,
            certificationDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateCertificationError(params.certificationNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<RuntimeCertificationRow[]>(
        `SELECT id, certification_id, certification_type, status, owner_server_id, certification_nonce,
                certification_data, certified_at, created_at, updated_at
         FROM atc_runtime_certification
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Runtime certification record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeCertification | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeCertificationRow[]>(
        `SELECT id, certification_id, certification_type, status, owner_server_id, certification_nonce,
                certification_data, certified_at, created_at, updated_at
         FROM atc_runtime_certification
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
    status: AtcCertificationStatus,
    certifiedAt?: Date | undefined
  ): Promise<AtcRuntimeCertification> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeCertificationRow[]>(
          `SELECT id, certification_id, certification_type, status, owner_server_id, certification_nonce,
                  certification_data, certified_at, created_at, updated_at
           FROM atc_runtime_certification
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new CertificationNotFoundError(id)

        if (certifiedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_certification
             SET status = ?, certified_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              certifiedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_certification
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<RuntimeCertificationRow[]>(
          `SELECT id, certification_id, certification_type, status, owner_server_id, certification_nonce,
                  certification_data, certified_at, created_at, updated_at
           FROM atc_runtime_certification
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new CertificationNotFoundError(id)

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
        `DELETE FROM atc_runtime_certification
         WHERE status IN ('expired', 'revoked', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
