import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeHardeningPool } from './pool.js'
import { generateId } from './id.js'

interface HardeningAuditRow extends RowDataPacket {
  id: string
  hardening_id: string
  event_type: string
  event_data: string | null
  occurred_at: Date
}

export interface AtcHardeningAuditEntry {
  id: string
  hardeningId: string
  eventType: string
  eventData: Record<string, unknown>
  occurredAt: Date
}

export class HardeningAuditRepository {
  constructor(private readonly pool: RuntimeHardeningPool) {}

  async append(
    hardeningId: string,
    eventType: string,
    eventData?: Record<string, unknown> | undefined
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const eventDataJson = eventData !== undefined ? JSON.stringify(eventData) : null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_hardening_audit
           (id, hardening_id, event_type, event_data, occurred_at)
         VALUES (?, ?, ?, ?, NOW(3))`,
        [id, hardeningId, eventType, eventDataJson] as (string | number | boolean | null)[]
      )
    } finally {
      conn.release()
    }
  }
}
