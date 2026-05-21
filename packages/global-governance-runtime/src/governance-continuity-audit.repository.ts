import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { GlobalGovernancePool } from './pool.js'
import { generateId } from './id.js'

interface GovernanceContinuityAuditRow extends RowDataPacket {
  id: string
  event_type: string
  directive_id: string | null
  owner_server_id: string | null
  audit_data: string | null
  created_at: Date
}

export interface AtcGovernanceContinuityAuditEntry {
  id: string
  eventType: string
  directiveId: string | null
  ownerServerId: string | null
  auditData: Record<string, unknown>
  createdAt: Date
}

export class GovernanceContinuityAuditRepository {
  constructor(private readonly pool: GlobalGovernancePool) {}

  async append(params: {
    eventType: string
    directiveId?: string | undefined
    ownerServerId?: string | undefined
    auditData?: Record<string, unknown> | undefined
  }): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const auditDataJson = params.auditData !== undefined ? JSON.stringify(params.auditData) : null
      const directiveId = params.directiveId ?? null
      const ownerServerId = params.ownerServerId ?? null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_governance_continuity_audit
           (id, event_type, directive_id, owner_server_id, audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [id, params.eventType, directiveId, ownerServerId, auditDataJson] as (string | number | boolean | null)[]
      )
    } finally {
      conn.release()
    }
  }
}
