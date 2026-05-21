import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { CoreClosurePool } from './pool.js'
import { generateId } from './id.js'

interface CoreClosureAuditRow extends RowDataPacket {
  id: string
  entity_id: string | null
  event_type: string
  event_data: string | null
  occurred_at: Date
}

export interface AtcCoreClosureAuditEntry {
  id: string
  entityId: string | null
  eventType: string
  eventData: Record<string, unknown>
  occurredAt: Date
}

export class CoreClosureAuditRepository {
  constructor(private readonly pool: CoreClosurePool) {}

  async append(
    entityId: string,
    eventType: string,
    eventData?: Record<string, unknown> | undefined
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const eventDataJson = eventData !== undefined ? JSON.stringify(eventData) : null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_core_closure_audit
           (id, entity_id, event_type, event_data, occurred_at)
         VALUES (?, ?, ?, ?, NOW(3))`,
        [id, entityId, eventType, eventDataJson] as unknown[]
      )
    } finally {
      conn.release()
    }
  }
}
