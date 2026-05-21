import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeLockdownPool } from './pool.js'
import { generateId } from './id.js'

interface LockdownAuditRow extends RowDataPacket {
  id: string
  event_type: string
  lockdown_id: string | null
  owner_server_id: string | null
  audit_data: string | null
  created_at: Date
}

export interface AtcLockdownAuditEntry {
  id: string
  eventType: string
  lockdownId: string | null
  ownerServerId: string | null
  auditData: Record<string, unknown>
  createdAt: Date
}

export class LockdownAuditRepository {
  constructor(private readonly pool: RuntimeLockdownPool) {}

  async append(params: {
    eventType: string
    lockdownId?: string | undefined
    ownerServerId?: string | undefined
    auditData?: Record<string, unknown> | undefined
  }): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const auditDataJson = params.auditData !== undefined ? JSON.stringify(params.auditData) : null
      const lockdownId = params.lockdownId ?? null
      const ownerServerId = params.ownerServerId ?? null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_lockdown_audit
           (id, event_type, lockdown_id, owner_server_id, audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [id, params.eventType, lockdownId, ownerServerId, auditDataJson] as (string | number | boolean | null)[]
      )
    } finally {
      conn.release()
    }
  }
}
