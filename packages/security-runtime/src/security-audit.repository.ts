import type { RowDataPacket } from 'mysql2/promise'
import type { SecurityRuntimePool } from './pool.js'
import { generateId } from './id.js'

export interface AtcSecurityAuditEntry {
  id: string
  eventType: string
  entityId: string | null
  ownerServerId: string | null
  auditData: Record<string, unknown>
  createdAt: Date
}

export interface AppendSecurityAuditParams {
  eventType: string
  entityId?: string | undefined
  ownerServerId?: string | undefined
  auditData?: Record<string, unknown> | undefined
}

interface AuditRow extends RowDataPacket {
  id: string
  event_type: string
  entity_id: string | null
  owner_server_id: string | null
  audit_data: string
  created_at: Date
}

export class SecurityAuditRepository {
  constructor(private pool: SecurityRuntimePool) {}

  async append(params: AppendSecurityAuditParams): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const auditData = JSON.stringify(params.auditData ?? {})
      await conn.execute(
        `INSERT INTO atc_security_audit
          (id, event_type, entity_id, owner_server_id, audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [id, params.eventType, params.entityId ?? null, params.ownerServerId ?? null, auditData],
      )
    } finally {
      conn.release()
    }
  }
}
