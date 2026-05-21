import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EnterpriseReadinessPool } from './pool.js'
import { generateId } from './id.js'
import { EnterpriseReadinessNotFoundError, DuplicateEnterpriseReadinessError } from './errors.js'

export type AtcEnterpriseReadinessType = 'technical' | 'operational' | 'security' | 'compliance' | 'custom'
export type AtcEnterpriseReadinessStatus = 'pending' | 'assessing' | 'ready' | 'not_ready' | 'failed'

export interface AtcEnterpriseReadiness {
  id: string
  readinessId: string
  readinessType: AtcEnterpriseReadinessType
  status: AtcEnterpriseReadinessStatus
  ownerServerId: string
  readinessNonce: string
  readinessData: Record<string, unknown>
  confirmedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateEnterpriseReadinessParams {
  readinessType: AtcEnterpriseReadinessType
  ownerServerId: string
  readinessNonce: string
  readinessData?: Record<string, unknown> | undefined
}

interface EnterpriseReadinessRow extends RowDataPacket {
  id: string
  readiness_id: string
  readiness_type: string
  status: string
  owner_server_id: string
  readiness_nonce: string
  readiness_data: string | null
  confirmed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: EnterpriseReadinessRow): AtcEnterpriseReadiness {
  let readinessData: Record<string, unknown> = {}
  if (row.readiness_data) {
    try {
      readinessData = JSON.parse(row.readiness_data) as Record<string, unknown>
    } catch {
      readinessData = {}
    }
  }
  return {
    id: row.id,
    readinessId: row.readiness_id,
    readinessType: row.readiness_type as AtcEnterpriseReadinessType,
    status: row.status as AtcEnterpriseReadinessStatus,
    ownerServerId: row.owner_server_id,
    readinessNonce: row.readiness_nonce,
    readinessData,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class EnterpriseReadinessRepository {
  constructor(private readonly pool: EnterpriseReadinessPool) {}

  async create(params: CreateEnterpriseReadinessParams): Promise<AtcEnterpriseReadiness> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const readinessId = generateId()
      const readinessDataJson = JSON.stringify(params.readinessData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_enterprise_readiness
             (id, readiness_id, readiness_type, status, owner_server_id,
              readiness_nonce, readiness_data, confirmed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            readinessId,
            params.readinessType,
            params.ownerServerId,
            params.readinessNonce,
            readinessDataJson,
          ] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateEnterpriseReadinessError(params.readinessNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<EnterpriseReadinessRow[]>(
        `SELECT id, readiness_id, readiness_type, status, owner_server_id,
                readiness_nonce, readiness_data, confirmed_at, created_at, updated_at
         FROM atc_enterprise_readiness
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) throw new Error(`Enterprise readiness not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcEnterpriseReadiness | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EnterpriseReadinessRow[]>(
        `SELECT id, readiness_id, readiness_type, status, owner_server_id,
                readiness_nonce, readiness_data, confirmed_at, created_at, updated_at
         FROM atc_enterprise_readiness
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
    status: AtcEnterpriseReadinessStatus,
    confirmedAt?: Date | undefined
  ): Promise<AtcEnterpriseReadiness> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<EnterpriseReadinessRow[]>(
          `SELECT id, readiness_id, readiness_type, status, owner_server_id,
                  readiness_nonce, readiness_data, confirmed_at, created_at, updated_at
           FROM atc_enterprise_readiness
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as unknown[]
        )
        if (!lockRows[0]) throw new EnterpriseReadinessNotFoundError(id)

        if (confirmedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_enterprise_readiness
             SET status = ?, confirmed_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, confirmedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_enterprise_readiness
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as unknown[]
          )
        }

        const [rows] = await conn.execute<EnterpriseReadinessRow[]>(
          `SELECT id, readiness_id, readiness_type, status, owner_server_id,
                  readiness_nonce, readiness_data, confirmed_at, created_at, updated_at
           FROM atc_enterprise_readiness
           WHERE id = ?
           LIMIT 1`,
          [id] as unknown[]
        )
        if (!rows[0]) throw new EnterpriseReadinessNotFoundError(id)

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
        `DELETE FROM atc_enterprise_readiness
         WHERE status IN ('not_ready', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
