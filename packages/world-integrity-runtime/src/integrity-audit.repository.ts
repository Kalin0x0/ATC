import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { WorldIntegrityPool } from './pool.js'
import { generateId } from './id.js'

interface IntegrityAuditRow extends RowDataPacket {
  id: string
  event_type: string
  integrity_id: string | null
  resource_key: string | null
  owner_server_id: string | null
  audit_data: string | null
  created_at: Date
}

export interface AtcIntegrityAuditEntry {
  id: string
  eventType: string
  integrityId: string | null
  resourceKey: string | null
  ownerServerId: string | null
  auditData: Record<string, unknown>
  createdAt: Date
}

export class IntegrityAuditRepository {
  constructor(private readonly pool: WorldIntegrityPool) {}

  async append(params: {
    eventType: string
    integrityId?: string | undefined
    resourceKey?: string | undefined
    ownerServerId?: string | undefined
    auditData?: Record<string, unknown> | undefined
  }): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const auditDataJson = params.auditData !== undefined ? JSON.stringify(params.auditData) : null
      const integrityId = params.integrityId ?? null
      const resourceKey = params.resourceKey ?? null
      const ownerServerId = params.ownerServerId ?? null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_integrity_audit
           (id, event_type, integrity_id, resource_key, owner_server_id, audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [id, params.eventType, integrityId, resourceKey, ownerServerId, auditDataJson] as (string | number | boolean | null)[]
      )
    } finally {
      conn.release()
    }
  }
}
