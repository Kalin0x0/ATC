import type { CommunicationRuntimePool } from './pool.js'
import { generateId } from './id.js'

export class CommunicationAuditRepository {
  constructor(private readonly pool: CommunicationRuntimePool) {}

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
      const actorIdValue = actorId !== undefined ? actorId : null
      const detailValue = detail !== undefined ? detail : null
      const binds: (string | number | boolean | null)[] = [
        id,
        subjectId,
        subjectType,
        action,
        actorIdValue,
        detailValue,
      ]
      await conn.execute(
        `INSERT INTO atc_communication_audit
           (id, subject_id, subject_type, action, actor_id, detail, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        binds,
      )
    } finally {
      conn.release()
    }
  }
}
