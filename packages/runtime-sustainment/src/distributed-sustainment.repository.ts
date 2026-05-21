import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeSustainmentPool } from './pool.js'
import { generateId } from './id.js'
import { SustainmentNodeNotFoundError } from './errors.js'

export type AtcSustainmentNodeType = 'primary' | 'secondary' | 'observer' | 'arbiter' | 'custom'
export type AtcSustainmentNodeStatus = 'active' | 'degraded' | 'recovering' | 'offline' | 'failed'

export interface AtcDistributedSustainment {
  id: string
  sustainmentNodeId: string
  nodeType: AtcSustainmentNodeType
  status: AtcSustainmentNodeStatus
  ownerServerId: string
  nodeData: Record<string, unknown>
  syncedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface RegisterNodeParams {
  sustainmentNodeId: string
  nodeType: AtcSustainmentNodeType
  ownerServerId: string
  nodeData?: Record<string, unknown> | undefined
}

interface DistributedSustainmentRow extends RowDataPacket {
  id: string
  sustainment_node_id: string
  node_type: string
  status: string
  owner_server_id: string
  node_data: string | null
  synced_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: DistributedSustainmentRow): AtcDistributedSustainment {
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
    sustainmentNodeId: row.sustainment_node_id,
    nodeType: row.node_type as AtcSustainmentNodeType,
    status: row.status as AtcSustainmentNodeStatus,
    ownerServerId: row.owner_server_id,
    nodeData,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class DistributedSustainmentRepository {
  constructor(private readonly pool: RuntimeSustainmentPool) {}

  async upsert(params: RegisterNodeParams): Promise<AtcDistributedSustainment> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const nodeDataJson = JSON.stringify(params.nodeData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_distributed_sustainment
           (id, sustainment_node_id, node_type, status, owner_server_id,
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
          params.sustainmentNodeId,
          params.nodeType,
          params.ownerServerId,
          nodeDataJson,
        ] as unknown[]
      )

      const [rows] = await conn.execute<DistributedSustainmentRow[]>(
        `SELECT id, sustainment_node_id, node_type, status, owner_server_id,
                node_data, synced_at, created_at, updated_at
         FROM atc_distributed_sustainment
         WHERE sustainment_node_id = ?
         LIMIT 1`,
        [params.sustainmentNodeId] as unknown[]
      )
      if (!rows[0]) throw new Error(`Distributed sustainment not found after upsert: ${params.sustainmentNodeId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByNodeId(sustainmentNodeId: string): Promise<AtcDistributedSustainment | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DistributedSustainmentRow[]>(
        `SELECT id, sustainment_node_id, node_type, status, owner_server_id,
                node_data, synced_at, created_at, updated_at
         FROM atc_distributed_sustainment
         WHERE sustainment_node_id = ?
         LIMIT 1`,
        [sustainmentNodeId] as unknown[]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    sustainmentNodeId: string,
    status: AtcSustainmentNodeStatus
  ): Promise<AtcDistributedSustainment> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<DistributedSustainmentRow[]>(
          `SELECT id, sustainment_node_id, node_type, status, owner_server_id,
                  node_data, synced_at, created_at, updated_at
           FROM atc_distributed_sustainment
           WHERE sustainment_node_id = ?
           LIMIT 1
           FOR UPDATE`,
          [sustainmentNodeId] as unknown[]
        )
        if (!lockRows[0]) throw new SustainmentNodeNotFoundError(sustainmentNodeId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_distributed_sustainment
           SET status = ?, updated_at = NOW(3)
           WHERE sustainment_node_id = ?`,
          [status, sustainmentNodeId] as unknown[]
        )

        const [rows] = await conn.execute<DistributedSustainmentRow[]>(
          `SELECT id, sustainment_node_id, node_type, status, owner_server_id,
                  node_data, synced_at, created_at, updated_at
           FROM atc_distributed_sustainment
           WHERE sustainment_node_id = ?
           LIMIT 1`,
          [sustainmentNodeId] as unknown[]
        )
        if (!rows[0]) throw new SustainmentNodeNotFoundError(sustainmentNodeId)

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
        `DELETE FROM atc_distributed_sustainment
         WHERE status IN ('offline', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
