import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeResiliencePool } from './pool.js'
import { generateId } from './id.js'

interface FailoverAuditRow extends RowDataPacket {
  id: string
  failover_id: string | null
  event_type: string
  audit_data: string | null
  created_at: Date
}

export interface AtcFailoverAuditEntry {
  id: string
  failoverId: string | null
  eventType: string
  auditData: Record<string, unknown>
  createdAt: Date
}

export class FailoverAuditRepository {
  constructor(private readonly pool: RuntimeResiliencePool) {}

  async append(params: {
    failoverId?: string | undefined
    eventType: string
    auditData?: Record<string, unknown> | undefined
  }): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const auditDataJson = params.auditData !== undefined ? JSON.stringify(params.auditData) : null
      const failoverId = params.failoverId ?? null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_failover_audit
           (id, failover_id, event_type, audit_data, created_at)
         VALUES (?, ?, ?, ?, NOW(3))`,
        [id, failoverId, params.eventType, auditDataJson] as (string | number | boolean | null)[]
      )
    } finally {
      conn.release()
    }
  }
}
