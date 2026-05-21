import type { EcologyRuntimePool } from './pool.js'
import { generateId } from './id.js'

export interface AppendEcologyAuditParams {
  eventType: string
  ecologyId?: string | undefined
  regionId?: string | undefined
  ownerServerId?: string | undefined
  auditData?: Record<string, unknown> | undefined
}

export class EcologyAuditRepository {
  constructor(private readonly pool: EcologyRuntimePool) {}

  async append(params: AppendEcologyAuditParams): Promise<void> {
    const id = generateId()
    const auditData = params.auditData !== undefined ? JSON.stringify(params.auditData) : null
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_ecology_audit
           (id, event_type, ecology_id, region_id, owner_server_id, audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.eventType,
          params.ecologyId ?? null,
          params.regionId ?? null,
          params.ownerServerId ?? null,
          auditData,
        ],
      )
    } finally {
      conn.release()
    }
  }
}
