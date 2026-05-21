import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeHardeningPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateImmutableSecurityError, ImmutableSecurityNotFoundError } from './errors.js'

export type AtcImmutableSecurityType = 'policy' | 'rule' | 'constraint' | 'invariant' | 'custom'
export type AtcImmutableSecurityStatus = 'pending' | 'active' | 'violated' | 'expired' | 'failed'

export interface AtcImmutableSecurity {
  id: string
  securityId: string
  securityType: AtcImmutableSecurityType
  status: AtcImmutableSecurityStatus
  ownerServerId: string
  securityNonce: string
  securityData: Record<string, unknown>
  enforcedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateImmutableSecurityParams {
  securityType: AtcImmutableSecurityType
  ownerServerId: string
  securityNonce: string
  securityData?: Record<string, unknown> | undefined
}

interface ImmutableSecurityRow extends RowDataPacket {
  id: string
  security_id: string
  security_type: string
  status: string
  owner_server_id: string
  security_nonce: string
  security_data: string | null
  enforced_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: ImmutableSecurityRow): AtcImmutableSecurity {
  let securityData: Record<string, unknown> = {}
  if (row.security_data) {
    try {
      securityData = JSON.parse(row.security_data) as Record<string, unknown>
    } catch {
      securityData = {}
    }
  }
  return {
    id: row.id,
    securityId: row.security_id,
    securityType: row.security_type as AtcImmutableSecurityType,
    status: row.status as AtcImmutableSecurityStatus,
    ownerServerId: row.owner_server_id,
    securityNonce: row.security_nonce,
    securityData,
    enforcedAt: row.enforced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ImmutableSecurityRepository {
  constructor(private readonly pool: RuntimeHardeningPool) {}

  async create(params: CreateImmutableSecurityParams): Promise<AtcImmutableSecurity> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const securityId = generateId()
      const securityDataJson = JSON.stringify(params.securityData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_immutable_security
             (id, security_id, security_type, status, owner_server_id, security_nonce,
              security_data, enforced_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            securityId,
            params.securityType,
            params.ownerServerId,
            params.securityNonce,
            securityDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateImmutableSecurityError(params.securityNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<ImmutableSecurityRow[]>(
        `SELECT id, security_id, security_type, status, owner_server_id, security_nonce,
                security_data, enforced_at, created_at, updated_at
         FROM atc_immutable_security
         WHERE id = ?
         LIMIT 1`,
        [id] as (string | number | boolean | null)[]
      )
      const row = rows[0]
      if (!row) throw new Error(`Immutable security record not found after insert: ${id}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcImmutableSecurity | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ImmutableSecurityRow[]>(
        `SELECT id, security_id, security_type, status, owner_server_id, security_nonce,
                security_data, enforced_at, created_at, updated_at
         FROM atc_immutable_security
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
    status: AtcImmutableSecurityStatus,
    enforcedAt?: Date | undefined
  ): Promise<AtcImmutableSecurity> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ImmutableSecurityRow[]>(
          `SELECT id, security_id, security_type, status, owner_server_id, security_nonce,
                  security_data, enforced_at, created_at, updated_at
           FROM atc_immutable_security
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as (string | number | boolean | null)[]
        )
        const lockRow = lockRows[0]
        if (!lockRow) throw new ImmutableSecurityNotFoundError(id)

        if (enforcedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_immutable_security
             SET status = ?, enforced_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              enforcedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_immutable_security
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<ImmutableSecurityRow[]>(
          `SELECT id, security_id, security_type, status, owner_server_id, security_nonce,
                  security_data, enforced_at, created_at, updated_at
           FROM atc_immutable_security
           WHERE id = ?
           LIMIT 1`,
          [id] as (string | number | boolean | null)[]
        )
        const row = rows[0]
        if (!row) throw new ImmutableSecurityNotFoundError(id)

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
        `DELETE FROM atc_immutable_security
         WHERE status IN ('violated', 'expired', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as (string | number | boolean | null)[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
