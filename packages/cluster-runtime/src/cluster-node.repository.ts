import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ClusterRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { ClusterNodeNotFoundError, DuplicateNodeError } from './errors.js'

export type AtcNodeType = 'game' | 'api' | 'proxy' | 'worker' | 'cache' | 'custom'
export type AtcNodeStatus = 'active' | 'draining' | 'offline' | 'maintenance'

export interface AtcClusterNode {
  id: string
  nodeId: string
  nodeType: AtcNodeType
  status: AtcNodeStatus
  ownerServerId: string
  address: string | null
  nodeNonce: string
  nodeData: Record<string, unknown>
  joinedAt: Date
  leftAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface RegisterNodeParams {
  nodeType: AtcNodeType
  ownerServerId: string
  nodeNonce: string
  address?: string | undefined
  nodeData?: Record<string, unknown> | undefined
}

interface NodeRow extends RowDataPacket {
  id: string
  node_id: string
  node_type: string
  status: string
  owner_server_id: string
  address: string | null
  node_nonce: string
  node_data: string | null
  joined_at: Date
  left_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: NodeRow): AtcClusterNode {
  let nodeData: Record<string, unknown> = {}
  if (row.node_data) {
    try { nodeData = JSON.parse(row.node_data) as Record<string, unknown> } catch { nodeData = {} }
  }
  return {
    id: row.id,
    nodeId: row.node_id,
    nodeType: row.node_type as AtcNodeType,
    status: row.status as AtcNodeStatus,
    ownerServerId: row.owner_server_id,
    address: row.address,
    nodeNonce: row.node_nonce,
    nodeData,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ClusterNodeRepository {
  constructor(private readonly pool: ClusterRuntimePool) {}

  async register(params: RegisterNodeParams): Promise<AtcClusterNode> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const nodeId = generateId()
      const nodeDataJson = JSON.stringify(params.nodeData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_cluster_nodes
             (id, node_id, node_type, status, owner_server_id, address, node_nonce,
              node_data, joined_at, left_at, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?, ?, ?, NOW(3), NULL, NOW(3), NOW(3))`,
          [id, nodeId, params.nodeType, params.ownerServerId,
           params.address ?? null, params.nodeNonce, nodeDataJson] as (string | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateNodeError(params.nodeNonce)
        throw err
      }

      const [rows] = await conn.execute<NodeRow[]>(
        `SELECT id, node_id, node_type, status, owner_server_id, address, node_nonce,
                node_data, joined_at, left_at, created_at, updated_at
         FROM atc_cluster_nodes WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Node not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcClusterNode | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<NodeRow[]>(
        `SELECT id, node_id, node_type, status, owner_server_id, address, node_nonce,
                node_data, joined_at, left_at, created_at, updated_at
         FROM atc_cluster_nodes WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcNodeStatus, leftAt?: Date | undefined): Promise<AtcClusterNode> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<NodeRow[]>(
          `SELECT id, node_id, node_type, status, owner_server_id, address, node_nonce,
                  node_data, joined_at, left_at, created_at, updated_at
           FROM atc_cluster_nodes WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new ClusterNodeNotFoundError(id)

        if (leftAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_cluster_nodes SET status = ?, left_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, leftAt.toISOString().replace('T', ' ').replace('Z', ''), id] as string[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_cluster_nodes SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id]
          )
        }

        const [rows] = await conn.execute<NodeRow[]>(
          `SELECT id, node_id, node_type, status, owner_server_id, address, node_nonce,
                  node_data, joined_at, left_at, created_at, updated_at
           FROM atc_cluster_nodes WHERE id = ? LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new ClusterNodeNotFoundError(id)
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

  async listActive(ownerServerId?: string | undefined): Promise<AtcClusterNode[]> {
    const conn = await this.pool.getConnection()
    try {
      if (ownerServerId !== undefined) {
        const [rows] = await conn.execute<NodeRow[]>(
          `SELECT id, node_id, node_type, status, owner_server_id, address, node_nonce,
                  node_data, joined_at, left_at, created_at, updated_at
           FROM atc_cluster_nodes WHERE status = 'active' AND owner_server_id = ? ORDER BY joined_at ASC`,
          [ownerServerId]
        )
        return rows.map(mapRow)
      }
      const [rows] = await conn.execute<NodeRow[]>(
        `SELECT id, node_id, node_type, status, owner_server_id, address, node_nonce,
                node_data, joined_at, left_at, created_at, updated_at
         FROM atc_cluster_nodes WHERE status = 'active' ORDER BY joined_at ASC`
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_cluster_nodes
         WHERE status IN ('offline', 'draining')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
