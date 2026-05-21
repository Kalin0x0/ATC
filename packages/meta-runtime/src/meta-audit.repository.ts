import type { ResultSetHeader } from 'mysql2/promise'
import type { MetaRuntimePool } from './pool.js'
import { generateId } from './id.js'

export interface AppendMetaAuditParams {
  eventType: string
  metaId?: string | undefined
  entityId?: string | undefined
  ownerServerId?: string | undefined
  auditData?: Record<string, unknown> | undefined
}

export class MetaAuditRepository {
  constructor(private readonly pool: MetaRuntimePool) {}

  async append(params: AppendMetaAuditParams): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_meta_audit
           (id, event_type, meta_id, entity_id, owner_server_id, audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.eventType,
          params.metaId ?? null,
          params.entityId ?? null,
          params.ownerServerId ?? null,
          JSON.stringify(params.auditData ?? {}),
        ] as (string | null)[],
      )
    } finally {
      conn.release()
    }
  }
}
