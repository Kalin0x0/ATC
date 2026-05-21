import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ClusterRuntimePool } from './pool.js'
import { generateId } from './id.js'

export interface AtcClusterAuditEntry {
  id: string
  nodeId: string | null
  eventType: string
  auditData: Record<string, unknown>
  createdAt: Date
}

export interface AppendClusterAuditParams {
  nodeId?: string | null | undefined
  eventType: string
  auditData?: Record<string, unknown> | undefined
}

interface AuditRow extends RowDataPacket {
  id: string
  node_id: string | null
  event_type: string
  audit_data: string | null
  created_at: Date
}

export class ClusterAuditRepository {
  constructor(private readonly pool: ClusterRuntimePool) {}

  async append(params: AppendClusterAuditParams): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_cluster_audit (id, node_id, event_type, audit_data, created_at)
         VALUES (?, ?, ?, ?, NOW(3))`,
        [id, params.nodeId ?? null, params.eventType,
         JSON.stringify(params.auditData ?? {})] as (string | null)[]
      )
    } finally {
      conn.release()
    }
  }
}
