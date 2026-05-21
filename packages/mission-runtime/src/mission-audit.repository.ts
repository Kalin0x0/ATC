import type { RowDataPacket } from 'mysql2/promise'
import type { MissionRuntimePool } from './pool.js'
import { generateId } from './id.js'

interface AuditRow extends RowDataPacket {
  id: string
  subject_id: string
  subject_type: string
  action: string
  actor_id: string | null
  detail: string | null
  occurred_at: Date
}

export class MissionAuditRepository {
  constructor(private readonly pool: MissionRuntimePool) {}

  async record(
    subjectId: string,
    subjectType: string,
    action: string,
    actorId?: string,
    detail?: string,
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const binds: (string | number | boolean | null)[] = [
        id,
        subjectId,
        subjectType,
        action,
        actorId ?? null,
        detail ?? null,
      ]
      await conn.execute<AuditRow[]>(
        `INSERT INTO atc_mission_audit
         (id, subject_id, subject_type, action, actor_id, detail, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        binds,
      )
    } finally {
      conn.release()
    }
  }
}
