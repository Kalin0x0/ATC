import type { TransportRuntimePool } from './pool.js'
import { generateId } from './id.js'

export class TransportAuditRepository {
  constructor(private readonly pool: TransportRuntimePool) {}

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
        actorId !== undefined ? actorId : null,
        detail !== undefined ? detail : null,
      ]
      await conn.execute(
        `INSERT INTO \`atc_transport_audit\`
           (\`id\`, \`subject_id\`, \`subject_type\`, \`action\`,
            \`actor_id\`, \`detail\`, \`occurred_at\`)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        binds,
      )
    } finally {
      conn.release()
    }
  }
}
