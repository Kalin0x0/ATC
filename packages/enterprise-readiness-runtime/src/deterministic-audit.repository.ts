import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EnterpriseReadinessPool } from './pool.js'
import { generateId } from './id.js'
import { DeterministicAuditNotFoundError, DuplicateDeterministicAuditError } from './errors.js'

export type AtcDeterministicAuditType = 'state' | 'transaction' | 'event' | 'consensus' | 'custom'
export type AtcDeterministicAuditStatus = 'pending' | 'auditing' | 'completed' | 'failed' | 'archived'

export interface AtcDeterministicAudit {
  id: string
  auditId: string
  auditType: AtcDeterministicAuditType
  status: AtcDeterministicAuditStatus
  ownerServerId: string
  auditNonce: string
  auditData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateDeterministicAuditParams {
  auditType: AtcDeterministicAuditType
  ownerServerId: string
  auditNonce: string
  auditData?: Record<string, unknown> | undefined
}

interface DeterministicAuditRow extends RowDataPacket {
  id: string
  audit_id: string
  audit_type: string
  status: string
  owner_server_id: string
  audit_nonce: string
  audit_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: DeterministicAuditRow): AtcDeterministicAudit {
  let auditData: Record<string, unknown> = {}
  if (row.audit_data) {
    try {
      auditData = JSON.parse(row.audit_data) as Record<string, unknown>
    } catch {
      auditData = {}
    }
  }
  return {
    id: row.id,
    auditId: row.audit_id,
    auditType: row.audit_type as AtcDeterministicAuditType,
    status: row.status as AtcDeterministicAuditStatus,
    ownerServerId: row.owner_server_id,
    auditNonce: row.audit_nonce,
    auditData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class DeterministicAuditRepository {
  constructor(private readonly pool: EnterpriseReadinessPool) {}

  async create(params: CreateDeterministicAuditParams): Promise<AtcDeterministicAudit> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const auditId = generateId()
      const auditDataJson = JSON.stringify(params.auditData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_deterministic_audit
             (id, audit_id, audit_type, status, owner_server_id,
              audit_nonce, audit_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            auditId,
            params.auditType,
            params.ownerServerId,
            params.auditNonce,
            auditDataJson,
          ] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateDeterministicAuditError(params.auditNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<DeterministicAuditRow[]>(
        `SELECT id, audit_id, audit_type, status, owner_server_id,
                audit_nonce, audit_data, completed_at, created_at, updated_at
         FROM atc_deterministic_audit
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) throw new Error(`Deterministic audit not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcDeterministicAudit | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DeterministicAuditRow[]>(
        `SELECT id, audit_id, audit_type, status, owner_server_id,
                audit_nonce, audit_data, completed_at, created_at, updated_at
         FROM atc_deterministic_audit
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
    status: AtcDeterministicAuditStatus,
    completedAt?: Date | undefined
  ): Promise<AtcDeterministicAudit> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<DeterministicAuditRow[]>(
          `SELECT id, audit_id, audit_type, status, owner_server_id,
                  audit_nonce, audit_data, completed_at, created_at, updated_at
           FROM atc_deterministic_audit
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as unknown[]
        )
        if (!lockRows[0]) throw new DeterministicAuditNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_deterministic_audit
             SET status = ?, completed_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_deterministic_audit
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as unknown[]
          )
        }

        const [rows] = await conn.execute<DeterministicAuditRow[]>(
          `SELECT id, audit_id, audit_type, status, owner_server_id,
                  audit_nonce, audit_data, completed_at, created_at, updated_at
           FROM atc_deterministic_audit
           WHERE id = ?
           LIMIT 1`,
          [id] as unknown[]
        )
        if (!rows[0]) throw new DeterministicAuditNotFoundError(id)

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
        `DELETE FROM atc_deterministic_audit
         WHERE status IN ('failed', 'archived')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
