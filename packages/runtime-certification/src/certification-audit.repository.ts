import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeCertificationPool } from './pool.js'
import { generateId } from './id.js'

interface CertificationAuditRow extends RowDataPacket {
  id: string
  event_type: string
  certification_id: string | null
  owner_server_id: string | null
  audit_data: string | null
  created_at: Date
}

export interface AtcCertificationAuditEntry {
  id: string
  eventType: string
  certificationId: string | null
  ownerServerId: string | null
  auditData: Record<string, unknown>
  createdAt: Date
}

export interface AppendCertificationAuditParams {
  eventType: string
  certificationId?: string | undefined
  ownerServerId?: string | undefined
  auditData?: Record<string, unknown> | undefined
}

export class CertificationAuditRepository {
  constructor(private readonly pool: RuntimeCertificationPool) {}

  async append(params: AppendCertificationAuditParams): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const auditDataJson = params.auditData !== undefined ? JSON.stringify(params.auditData) : null
      const certificationId = params.certificationId ?? null
      const ownerServerId = params.ownerServerId ?? null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_certification_audit
           (id, event_type, certification_id, owner_server_id, audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [id, params.eventType, certificationId, ownerServerId, auditDataJson] as (string | number | boolean | null)[]
      )
    } finally {
      conn.release()
    }
  }
}
