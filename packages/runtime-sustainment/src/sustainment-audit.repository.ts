import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeSustainmentPool } from './pool.js'
import { generateId } from './id.js'

interface SustainmentAuditRow extends RowDataPacket {
  id: string
  sustainment_id: string
  event_type: string
  event_data: string | null
  occurred_at: Date
}

export interface AtcSustainmentAuditEntry {
  id: string
  sustainmentId: string
  eventType: string
  eventData: Record<string, unknown>
  occurredAt: Date
}

export class SustainmentAuditRepository {
  constructor(private readonly pool: RuntimeSustainmentPool) {}

  async append(
    sustainmentId: string,
    eventType: string,
    eventData?: Record<string, unknown> | undefined
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const eventDataJson = eventData !== undefined ? JSON.stringify(eventData) : null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_sustainment_audit
           (id, sustainment_id, event_type, event_data, occurred_at)
         VALUES (?, ?, ?, ?, NOW(3))`,
        [id, sustainmentId, eventType, eventDataJson] as unknown[]
      )
    } finally {
      conn.release()
    }
  }
}
