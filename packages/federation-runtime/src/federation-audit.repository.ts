import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { FederationRuntimePool } from './pool.js'
import { generateId } from './id.js'

export interface AtcFederationAuditEntry {
  id: string
  eventType: string
  federationNodeId: string | null
  regionId: string | null
  entityId: string | null
  ownerServerId: string | null
  auditData: Record<string, unknown>
  createdAt: Date
}

export interface AppendFederationAuditParams {
  eventType: string
  federationNodeId?: string | undefined
  regionId?: string | undefined
  entityId?: string | undefined
  ownerServerId?: string | undefined
  auditData?: Record<string, unknown> | undefined
}

interface FederationAuditRow extends RowDataPacket {
  id: string
  event_type: string
  federation_node_id: string | null
  region_id: string | null
  entity_id: string | null
  owner_server_id: string | null
  audit_data: string | null
  created_at: Date
}

export class FederationAuditRepository {
  constructor(private readonly pool: FederationRuntimePool) {}

  async append(params: AppendFederationAuditParams): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_federation_audit
           (id, event_type, federation_node_id, region_id, entity_id, owner_server_id, audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [id, params.eventType, params.federationNodeId ?? null, params.regionId ?? null,
         params.entityId ?? null, params.ownerServerId ?? null,
         JSON.stringify(params.auditData ?? {})] as (string | null)[]
      )
    } finally {
      conn.release()
    }
  }
}
