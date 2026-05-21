import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ContinuityRuntimePool } from './pool.js'
import { generateId } from './id.js'

interface ContinuityAuditRow extends RowDataPacket {
  id: string
  event_type: string
  continuity_id: string | null
  owner_server_id: string | null
  audit_data: string | null
  created_at: Date
}

export interface AtcContinuityAuditEntry {
  id: string
  eventType: string
  continuityId: string | null
  ownerServerId: string | null
  auditData: Record<string, unknown>
  createdAt: Date
}

export class ContinuityAuditRepository {
  constructor(private readonly pool: ContinuityRuntimePool) {}

  async append(params: {
    eventType: string
    continuityId?: string | undefined
    ownerServerId?: string | undefined
    auditData?: Record<string, unknown> | undefined
  }): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const auditDataJson = params.auditData !== undefined ? JSON.stringify(params.auditData) : null
      const continuityId = params.continuityId ?? null
      const ownerServerId = params.ownerServerId ?? null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_continuity_audit
           (id, event_type, continuity_id, owner_server_id, audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [id, params.eventType, continuityId, ownerServerId, auditDataJson] as (string | number | boolean | null)[]
      )
    } finally {
      conn.release()
    }
  }
}
