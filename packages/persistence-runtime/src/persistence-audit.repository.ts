import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { PersistenceRuntimePool } from './pool.js'
import { generateId } from './id.js'

export interface AtcPersistenceAuditEntry {
  id: string
  snapshotId: string | null
  eventType: string
  auditData: Record<string, unknown>
  createdAt: Date
}

export interface AppendPersistenceAuditParams {
  snapshotId?: string | null | undefined
  eventType: string
  auditData?: Record<string, unknown> | undefined
}

interface AuditRow extends RowDataPacket {
  id: string
  snapshot_id: string | null
  event_type: string
  audit_data: string | null
  created_at: Date
}

export class PersistenceAuditRepository {
  constructor(private readonly pool: PersistenceRuntimePool) {}

  async append(params: AppendPersistenceAuditParams): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_persistence_audit (id, snapshot_id, event_type, audit_data, created_at)
         VALUES (?, ?, ?, ?, NOW(3))`,
        [id, params.snapshotId ?? null, params.eventType,
         JSON.stringify(params.auditData ?? {})] as (string | null)[]
      )
    } finally {
      conn.release()
    }
  }
}
