import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { SovereigntyRuntimePool } from './pool.js'
import { generateId } from './id.js'

interface SovereigntyAuditRow extends RowDataPacket {
  id: string
  event_type: string
  sovereignty_id: string | null
  owner_server_id: string | null
  audit_data: string | null
  created_at: Date
}

export interface AtcSovereigntyAuditEntry {
  id: string
  eventType: string
  sovereigntyId: string | null
  ownerServerId: string | null
  auditData: Record<string, unknown>
  createdAt: Date
}

export interface AppendSovereigntyAuditParams {
  eventType: string
  sovereigntyId?: string | undefined
  ownerServerId?: string | undefined
  auditData?: Record<string, unknown> | undefined
}

export class SovereigntyAuditRepository {
  constructor(private readonly pool: SovereigntyRuntimePool) {}

  async append(params: AppendSovereigntyAuditParams): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const auditDataJson = params.auditData !== undefined ? JSON.stringify(params.auditData) : null
      const sovereigntyId = params.sovereigntyId ?? null
      const ownerServerId = params.ownerServerId ?? null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_sovereignty_audit
           (id, event_type, sovereignty_id, owner_server_id, audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [id, params.eventType, sovereigntyId, ownerServerId, auditDataJson] as (string | number | boolean | null)[]
      )
    } finally {
      conn.release()
    }
  }
}
