import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeProtocolPool } from './pool.js'
import { generateId } from './id.js'

export interface AtcProtocolAuditEntry {
  id: string
  eventType: string
  protocolId: string | null
  contractId: string | null
  ownerServerId: string | null
  auditData: Record<string, unknown>
  createdAt: Date
}

export interface AppendProtocolAuditParams {
  eventType: string
  protocolId?: string | undefined
  contractId?: string | undefined
  ownerServerId?: string | undefined
  auditData?: Record<string, unknown> | undefined
}

interface ProtocolAuditRow extends RowDataPacket {
  id: string
  event_type: string
  protocol_id: string | null
  contract_id: string | null
  owner_server_id: string | null
  audit_data: string | null
  created_at: Date
}

export class ProtocolAuditRepository {
  constructor(private readonly pool: RuntimeProtocolPool) {}

  async append(params: AppendProtocolAuditParams): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_protocol_audit
           (id, event_type, protocol_id, contract_id, owner_server_id, audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.eventType,
          params.protocolId ?? null,
          params.contractId ?? null,
          params.ownerServerId ?? null,
          JSON.stringify(params.auditData ?? {}),
        ],
      )
    } finally {
      conn.release()
    }
  }
}
