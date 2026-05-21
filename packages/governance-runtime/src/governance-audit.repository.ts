import type { ResultSetHeader } from 'mysql2/promise'
import type { GovernanceRuntimePool } from './pool.js'
import { generateId } from './id.js'

export interface AppendGovernanceAuditParams {
  eventType: string
  governanceId?: string | undefined
  entityId?: string | undefined
  ownerServerId?: string | undefined
  regionId?: string | undefined
  auditData?: Record<string, unknown> | undefined
}

export class GovernanceAuditRepository {
  constructor(private readonly pool: GovernanceRuntimePool) {}

  async append(params: AppendGovernanceAuditParams): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const auditDataJson = JSON.stringify(params.auditData ?? {})
      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_governance_audit
           (id, event_type, governance_id, entity_id, owner_server_id, region_id,
            audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.eventType,
          params.governanceId ?? null,
          params.entityId ?? null,
          params.ownerServerId ?? null,
          params.regionId ?? null,
          auditDataJson,
        ],
      )
    } finally {
      conn.release()
    }
  }
}
