import type { RowDataPacket } from 'mysql2/promise'
import { generateId } from './id.js'
import type { ReputationRuntimePool } from './pool.js'

interface RelationshipAuditRow extends RowDataPacket {
  id: string
  subject_id: string
  subject_type: string
  action: string
  actor_id: string | null
  detail: string | null
  occurred_at: Date
}

export class RelationshipAuditRepository {
  constructor(private readonly pool: ReputationRuntimePool) {}

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
      await conn.execute<RelationshipAuditRow[]>(
        `INSERT INTO atc_relationship_audit
           (id, subject_id, subject_type, action, actor_id, detail, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          subjectId,
          subjectType,
          action,
          actorId ?? null,
          detail ?? null,
        ],
      )
    } finally {
      conn.release()
    }
  }
}
