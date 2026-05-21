import type { RowDataPacket } from 'mysql2/promise'
import { generateId } from './id.js'
import type { AiRuntimePool } from './pool.js'

export interface AiAuditRecord {
  id: string
  subjectId: string
  subjectType: string
  action: string
  actorId: string | null
  detail: Record<string, unknown> | null
  occurredAt: Date
}

interface AiAuditRow extends RowDataPacket {
  id: string
  subject_id: string
  subject_type: string
  action: string
  actor_id: string | null
  detail: string | null
  occurred_at: Date
}

export class AiAuditRepository {
  constructor(private readonly pool: AiRuntimePool) {}

  async record(
    subjectId: string,
    subjectType: string,
    action: string,
    actorId?: string,
    detail?: Record<string, unknown>,
  ): Promise<void> {
    const id = generateId()
    const actorIdValue: string | null = actorId ?? null
    const detailValue: string | null = detail !== undefined ? JSON.stringify(detail) : null

    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_ai_audit
           (id, subject_id, subject_type, action, actor_id, detail, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [id, subjectId, subjectType, action, actorIdValue, detailValue],
      )
    } finally {
      conn.release()
    }
  }
}
