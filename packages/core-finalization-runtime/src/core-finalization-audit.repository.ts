import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { CoreFinalizationPool } from './pool.js'
import { generateId } from './id.js'

interface CoreFinalizationAuditRow extends RowDataPacket {
  id: string
  event_type: string
  finalization_id: string | null
  owner_server_id: string | null
  audit_data: string | null
  created_at: Date
}

export interface AtcCoreFinalizationAuditEntry {
  id: string
  eventType: string
  finalizationId: string | null
  ownerServerId: string | null
  auditData: Record<string, unknown>
  createdAt: Date
}

export interface AppendCoreFinalizationAuditParams {
  eventType: string
  finalizationId?: string | undefined
  ownerServerId?: string | undefined
  auditData?: Record<string, unknown> | undefined
}

export class CoreFinalizationAuditRepository {
  constructor(private readonly pool: CoreFinalizationPool) {}

  async append(params: AppendCoreFinalizationAuditParams): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const auditDataJson = params.auditData !== undefined ? JSON.stringify(params.auditData) : null
      const finalizationId = params.finalizationId ?? null
      const ownerServerId = params.ownerServerId ?? null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_core_finalization_audit
           (id, event_type, finalization_id, owner_server_id, audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [id, params.eventType, finalizationId, ownerServerId, auditDataJson] as (string | number | boolean | null)[]
      )
    } finally {
      conn.release()
    }
  }
}
