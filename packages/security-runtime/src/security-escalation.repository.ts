import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { SecurityRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateEscalationError, EscalationNotFoundError } from './errors.js'

export type AtcEscalationType =
  | 'admin_review'
  | 'automated_ban'
  | 'service_isolation'
  | 'emergency_shutdown'
  | 'custom'

export type AtcEscalationStatus = 'pending' | 'active' | 'resolved' | 'dismissed'

export interface AtcSecurityEscalation {
  id: string
  escalationId: string
  escalationType: AtcEscalationType
  status: AtcEscalationStatus
  ownerServerId: string
  entityId: string | null
  escalationNonce: string
  resolvedAt: Date | null
  escalationData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface CreateEscalationParams {
  escalationType: AtcEscalationType
  ownerServerId: string
  escalationNonce: string
  entityId?: string | undefined
  escalationData?: Record<string, unknown> | undefined
}

interface EscalationRow extends RowDataPacket {
  id: string
  escalation_id: string
  escalation_type: AtcEscalationType
  status: AtcEscalationStatus
  owner_server_id: string
  entity_id: string | null
  escalation_nonce: string
  resolved_at: Date | null
  escalation_data: string
  created_at: Date
  updated_at: Date
}

function mapRow(row: EscalationRow): AtcSecurityEscalation {
  return {
    id: row.id,
    escalationId: row.escalation_id,
    escalationType: row.escalation_type,
    status: row.status,
    ownerServerId: row.owner_server_id,
    entityId: row.entity_id,
    escalationNonce: row.escalation_nonce,
    resolvedAt: row.resolved_at,
    escalationData: typeof row.escalation_data === 'string' ? JSON.parse(row.escalation_data) : row.escalation_data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SecurityEscalationRepository {
  constructor(private pool: SecurityRuntimePool) {}

  async create(params: CreateEscalationParams): Promise<AtcSecurityEscalation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const escalationId = generateId()
      const escalationData = JSON.stringify(params.escalationData ?? {})
      try {
        await conn.execute(
          `INSERT INTO atc_security_escalations
            (id, escalation_id, escalation_type, status, owner_server_id, entity_id, escalation_nonce, resolved_at, escalation_data, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, ?, NOW(3), NOW(3))`,
          [id, escalationId, params.escalationType, params.ownerServerId, params.entityId ?? null, params.escalationNonce, escalationData],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateEscalationError(params.escalationNonce)
        }
        throw err
      }
      const [rows] = await conn.execute<EscalationRow[]>(
        `SELECT * FROM atc_security_escalations WHERE id = ?`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new EscalationNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcSecurityEscalation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EscalationRow[]>(
        `SELECT * FROM atc_security_escalations WHERE id = ?`,
        [id],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcEscalationStatus, resolvedAt?: Date): Promise<AtcSecurityEscalation> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [locked] = await conn.execute<EscalationRow[]>(
          `SELECT * FROM atc_security_escalations WHERE id = ? FOR UPDATE`,
          [id],
        )
        if (!locked[0]) {
          throw new EscalationNotFoundError(id)
        }
        await conn.execute(
          `UPDATE atc_security_escalations SET status = ?, resolved_at = ?, updated_at = NOW(3) WHERE id = ?`,
          [status, resolvedAt ?? null, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [rows] = await conn.execute<EscalationRow[]>(
        `SELECT * FROM atc_security_escalations WHERE id = ?`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new EscalationNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const threshold = new Date(Date.now() - thresholdMs)
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_security_escalations WHERE status IN ('resolved', 'dismissed') AND updated_at < ?`,
        [threshold],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
