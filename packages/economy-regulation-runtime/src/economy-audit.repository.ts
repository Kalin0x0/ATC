import type { RowDataPacket } from 'mysql2/promise'
import type { EconomyRegulationPool } from './pool.js'
import { generateId } from './id.js'

export interface AtcEconomyAuditEntry {
  id: string
  eventType: string
  regionId: string | null
  ownerServerId: string | null
  auditData: Record<string, unknown>
  createdAt: Date
}

export interface AppendEconomyAuditParams {
  eventType: string
  regionId?: string | undefined
  ownerServerId?: string | undefined
  auditData?: Record<string, unknown> | undefined
}

interface AuditRow extends RowDataPacket {
  id: string
  event_type: string
  region_id: string | null
  owner_server_id: string | null
  audit_data: string
  created_at: Date
}

export class EconomyAuditRepository {
  constructor(private pool: EconomyRegulationPool) {}

  async append(params: AppendEconomyAuditParams): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const auditData = JSON.stringify(params.auditData ?? {})
      await conn.execute(
        `INSERT INTO atc_economy_audit
          (id, event_type, region_id, owner_server_id, audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [id, params.eventType, params.regionId ?? null, params.ownerServerId ?? null, auditData],
      )
    } finally {
      conn.release()
    }
  }
}
