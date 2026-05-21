import type { RowDataPacket } from 'mysql2/promise'
import type { DisasterRuntimePool } from './pool.js'
import { generateId } from './id.js'

interface DisasterAuditRow extends RowDataPacket {
  id: string
  subject_id: string
  subject_type: string
  action: string
  actor_id: string | null
  detail: string | null
  occurred_at: Date
}

export class DisasterAuditRepository {
  constructor(private readonly pool: DisasterRuntimePool) {}

  async record(
    subjectId: string,
    subjectType: string,
    action: string,
    actorId?: string,
    detail?: string,
  ): Promise<void> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_disaster_audit
           (id, subject_id, subject_type, action, actor_id, detail, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          subjectId,
          subjectType,
          action,
          actorId ?? null,
          detail ?? null,
        ] as (string | number | boolean | null)[],
      )
    } finally {
      conn.release()
    }
  }
}
