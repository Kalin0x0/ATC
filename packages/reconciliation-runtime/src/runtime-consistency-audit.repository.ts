import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReconciliationRuntimePool } from './pool.js'
import { generateId } from './id.js'

interface ConsistencyAuditRow extends RowDataPacket {
  id: string
  subject_id: string
  action: string
  server_id: string | null
  detail: string | null
  occurred_at: Date
}

export class RuntimeConsistencyAuditRepository {
  constructor(private readonly pool: ReconciliationRuntimePool) {}

  async record(
    subjectId: string,
    action: string,
    serverId?: string | undefined,
    detail?: Record<string, unknown> | undefined
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const detailJson = detail ? JSON.stringify(detail) : null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_runtime_consistency_audit
           (id, subject_id, action, server_id, detail, occurred_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          subjectId,
          action,
          serverId ?? null,
          detailJson,
        ] as (string | number | boolean | null)[]
      )
    } finally {
      conn.release()
    }
  }
}

// Re-export the row type for consumers who need it (e.g. query-side utilities)
export type { ConsistencyAuditRow }
