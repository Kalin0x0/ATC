import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EnterpriseReadinessPool } from './pool.js'
import { generateId } from './id.js'
import { DistributedAuditNotFoundError } from './errors.js'

export type AtcAuditNodeType = 'primary' | 'secondary' | 'observer' | 'arbiter' | 'custom'
export type AtcAuditNodeStatus = 'active' | 'syncing' | 'synced' | 'degraded' | 'failed'

export interface AtcDistributedAudit {
  id: string
  auditNodeId: string
  nodeType: AtcAuditNodeType
  status: AtcAuditNodeStatus
  ownerServerId: string
  nodeData: Record<string, unknown>
  syncedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface RegisterAuditNodeParams {
  auditNodeId: string
  nodeType: AtcAuditNodeType
  ownerServerId: string
  nodeData?: Record<string, unknown> | undefined
}

interface DistributedAuditRow extends RowDataPacket {
  id: string
  audit_node_id: string
  node_type: string
  status: string
  owner_server_id: string
  node_data: string | null
  synced_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: DistributedAuditRow): AtcDistributedAudit {
  let nodeData: Record<string, unknown> = {}
  if (row.node_data) {
    try {
      nodeData = JSON.parse(row.node_data) as Record<string, unknown>
    } catch {
      nodeData = {}
    }
  }
  return {
    id: row.id,
    auditNodeId: row.audit_node_id,
    nodeType: row.node_type as AtcAuditNodeType,
    status: row.status as AtcAuditNodeStatus,
    ownerServerId: row.owner_server_id,
    nodeData,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class DistributedAuditRepository {
  constructor(private readonly pool: EnterpriseReadinessPool) {}

  async upsert(params: RegisterAuditNodeParams): Promise<AtcDistributedAudit> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const nodeDataJson = JSON.stringify(params.nodeData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_distributed_audit
           (id, audit_node_id, node_type, status, owner_server_id,
            node_data, synced_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           node_type = VALUES(node_type),
           status = VALUES(status),
           owner_server_id = VALUES(owner_server_id),
           node_data = VALUES(node_data),
           synced_at = NOW(3),
           updated_at = NOW(3)`,
        [
          id,
          params.auditNodeId,
          params.nodeType,
          params.ownerServerId,
          nodeDataJson,
        ] as unknown[]
      )

      const [rows] = await conn.execute<DistributedAuditRow[]>(
        `SELECT id, audit_node_id, node_type, status, owner_server_id,
                node_data, synced_at, created_at, updated_at
         FROM atc_distributed_audit
         WHERE audit_node_id = ?
         LIMIT 1`,
        [params.auditNodeId] as unknown[]
      )
      if (!rows[0]) throw new Error(`Distributed audit not found after upsert: ${params.auditNodeId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByNodeId(auditNodeId: string): Promise<AtcDistributedAudit | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DistributedAuditRow[]>(
        `SELECT id, audit_node_id, node_type, status, owner_server_id,
                node_data, synced_at, created_at, updated_at
         FROM atc_distributed_audit
         WHERE audit_node_id = ?
         LIMIT 1`,
        [auditNodeId] as unknown[]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    auditNodeId: string,
    status: AtcAuditNodeStatus
  ): Promise<AtcDistributedAudit> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<DistributedAuditRow[]>(
          `SELECT id, audit_node_id, node_type, status, owner_server_id,
                  node_data, synced_at, created_at, updated_at
           FROM atc_distributed_audit
           WHERE audit_node_id = ?
           LIMIT 1
           FOR UPDATE`,
          [auditNodeId] as unknown[]
        )
        if (!lockRows[0]) throw new DistributedAuditNotFoundError(auditNodeId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_distributed_audit
           SET status = ?, updated_at = NOW(3)
           WHERE audit_node_id = ?`,
          [status, auditNodeId] as unknown[]
        )

        const [rows] = await conn.execute<DistributedAuditRow[]>(
          `SELECT id, audit_node_id, node_type, status, owner_server_id,
                  node_data, synced_at, created_at, updated_at
           FROM atc_distributed_audit
           WHERE audit_node_id = ?
           LIMIT 1`,
          [auditNodeId] as unknown[]
        )
        if (!rows[0]) throw new DistributedAuditNotFoundError(auditNodeId)

        await conn.commit()
        return mapRow(rows[0])
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_distributed_audit
         WHERE status IN ('degraded', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
