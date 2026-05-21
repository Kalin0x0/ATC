import type { RowDataPacket } from 'mysql2/promise'
import type { NarrativeRuntimePool } from './pool.js'
import { generateId } from './id.js'

interface NarrativeAuditRow extends RowDataPacket {
  id: string
  session_id: string | null
  event_type: string
  entity_id: string | null
  audit_data: string
  created_at: Date
}

export interface AtcNarrativeAuditEntry {
  id: string
  sessionId: string | null
  eventType: string
  entityId: string | null
  auditData: Record<string, unknown>
  createdAt: Date
}

export interface AppendAuditParams {
  sessionId?: string | undefined
  eventType: string
  entityId?: string | undefined
  auditData?: Record<string, unknown> | undefined
}

export class NarrativeAuditRepository {
  constructor(private readonly pool: NarrativeRuntimePool) {}

  async append(params: AppendAuditParams): Promise<void> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_narrative_audit
           (id, session_id, event_type, entity_id, audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.sessionId ?? null,
          params.eventType,
          params.entityId ?? null,
          JSON.stringify(params.auditData ?? {}),
        ],
      )
    } finally {
      conn.release()
    }
  }
}
