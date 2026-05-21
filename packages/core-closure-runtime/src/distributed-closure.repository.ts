import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { CoreClosurePool } from './pool.js'
import { generateId } from './id.js'
import { DistributedClosureNotFoundError } from './errors.js'

export type AtcClosureNodeType = 'primary' | 'secondary' | 'observer' | 'arbiter' | 'custom'
export type AtcClosureNodeStatus = 'active' | 'syncing' | 'synced' | 'degraded' | 'failed'

export interface AtcDistributedClosure {
  id: string
  closureNodeId: string
  nodeType: AtcClosureNodeType
  status: AtcClosureNodeStatus
  ownerServerId: string
  closureNodeData: Record<string, unknown>
  syncedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface RegisterClosureNodeParams {
  closureNodeId: string
  nodeType: AtcClosureNodeType
  ownerServerId: string
  closureNodeData?: Record<string, unknown> | undefined
}

interface DistributedClosureRow extends RowDataPacket {
  id: string
  closure_node_id: string
  node_type: string
  status: string
  owner_server_id: string
  closure_node_data: string | null
  synced_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: DistributedClosureRow): AtcDistributedClosure {
  let closureNodeData: Record<string, unknown> = {}
  if (row.closure_node_data) {
    try {
      closureNodeData = JSON.parse(row.closure_node_data) as Record<string, unknown>
    } catch {
      closureNodeData = {}
    }
  }
  return {
    id: row.id,
    closureNodeId: row.closure_node_id,
    nodeType: row.node_type as AtcClosureNodeType,
    status: row.status as AtcClosureNodeStatus,
    ownerServerId: row.owner_server_id,
    closureNodeData,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class DistributedClosureRepository {
  constructor(private readonly pool: CoreClosurePool) {}

  async upsert(params: RegisterClosureNodeParams): Promise<AtcDistributedClosure> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const closureNodeDataJson = JSON.stringify(params.closureNodeData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_distributed_closure
           (id, closure_node_id, node_type, status, owner_server_id,
            closure_node_data, synced_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           node_type = VALUES(node_type),
           status = VALUES(status),
           owner_server_id = VALUES(owner_server_id),
           closure_node_data = VALUES(closure_node_data),
           synced_at = NOW(3),
           updated_at = NOW(3)`,
        [
          id,
          params.closureNodeId,
          params.nodeType,
          params.ownerServerId,
          closureNodeDataJson,
        ] as unknown[]
      )

      const [rows] = await conn.execute<DistributedClosureRow[]>(
        `SELECT id, closure_node_id, node_type, status, owner_server_id,
                closure_node_data, synced_at, created_at, updated_at
         FROM atc_distributed_closure
         WHERE closure_node_id = ?
         LIMIT 1`,
        [params.closureNodeId] as unknown[]
      )
      if (!rows[0]) throw new Error(`Distributed closure not found after upsert: ${params.closureNodeId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByNodeId(closureNodeId: string): Promise<AtcDistributedClosure | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DistributedClosureRow[]>(
        `SELECT id, closure_node_id, node_type, status, owner_server_id,
                closure_node_data, synced_at, created_at, updated_at
         FROM atc_distributed_closure
         WHERE closure_node_id = ?
         LIMIT 1`,
        [closureNodeId] as unknown[]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    closureNodeId: string,
    status: AtcClosureNodeStatus
  ): Promise<AtcDistributedClosure> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<DistributedClosureRow[]>(
          `SELECT id, closure_node_id, node_type, status, owner_server_id,
                  closure_node_data, synced_at, created_at, updated_at
           FROM atc_distributed_closure
           WHERE closure_node_id = ?
           LIMIT 1
           FOR UPDATE`,
          [closureNodeId] as unknown[]
        )
        if (!lockRows[0]) throw new DistributedClosureNotFoundError(closureNodeId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_distributed_closure
           SET status = ?, updated_at = NOW(3)
           WHERE closure_node_id = ?`,
          [status, closureNodeId] as unknown[]
        )

        const [rows] = await conn.execute<DistributedClosureRow[]>(
          `SELECT id, closure_node_id, node_type, status, owner_server_id,
                  closure_node_data, synced_at, created_at, updated_at
           FROM atc_distributed_closure
           WHERE closure_node_id = ?
           LIMIT 1`,
          [closureNodeId] as unknown[]
        )
        if (!rows[0]) throw new DistributedClosureNotFoundError(closureNodeId)

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
        `DELETE FROM atc_distributed_closure
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
