import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReplicationRuntimePool } from './pool.js'
import { generateId } from './id.js'

interface ReplicationAuditRow extends RowDataPacket {
  id: string
  subject_id: string
  action: string
  server_id: string | null
  detail: string | null
  occurred_at: Date
}

export interface AtcReplicationAuditEntry {
  id: string
  subjectId: string
  action: string
  serverId: string | null
  detail: Record<string, unknown> | null
  occurredAt: Date
}

export class ReplicationAuditRepository {
  constructor(private readonly pool: ReplicationRuntimePool) {}

  async record(
    subjectId: string,
    action: string,
    serverId?: string | undefined,
    detail?: Record<string, unknown> | undefined
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const detailJson = detail !== undefined ? JSON.stringify(detail) : null
      const serverIdValue = serverId ?? null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_replication_audit
           (id, subject_id, action, server_id, detail, occurred_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [id, subjectId, action, serverIdValue, detailJson]
      )
    } finally {
      conn.release()
    }
  }
}
