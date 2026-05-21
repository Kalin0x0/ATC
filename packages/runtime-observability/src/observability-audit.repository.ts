import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeObservabilityPool } from './pool.js'
import { generateId } from './id.js'

export interface AtcObservabilityAuditEntry {
  id: string
  traceId: string | null
  eventType: string
  auditData: Record<string, unknown>
  createdAt: Date
}

export interface AppendObservabilityAuditParams {
  traceId?: string | null | undefined
  eventType: string
  auditData?: Record<string, unknown> | undefined
}

interface AuditRow extends RowDataPacket {
  id: string
  trace_id: string | null
  event_type: string
  audit_data: string | null
  created_at: Date
}

export class ObservabilityAuditRepository {
  constructor(private readonly pool: RuntimeObservabilityPool) {}

  async append(params: AppendObservabilityAuditParams): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_observability_audit (id, trace_id, event_type, audit_data, created_at)
         VALUES (?, ?, ?, ?, NOW(3))`,
        [id, params.traceId ?? null, params.eventType,
         JSON.stringify(params.auditData ?? {})] as (string | null)[]
      )
    } finally {
      conn.release()
    }
  }
}
