import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { FederationRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { FederationNodeNotFoundError, DuplicateFederationNodeError } from './errors.js'

export type AtcFederationNodeType = 'game_server' | 'api_server' | 'edge_node' | 'hub_node' | 'relay_node' | 'custom'
export type AtcFederationNodeStatus = 'active' | 'draining' | 'offline' | 'maintenance'

export interface AtcFederationNode {
  id: string
  nodeId: string
  nodeType: AtcFederationNodeType
  status: AtcFederationNodeStatus
  ownerServerId: string
  regionId: string | null
  address: string | null
  nodeNonce: string
  nodeData: Record<string, unknown>
  joinedAt: Date
  leftAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface RegisterFederationNodeParams {
  nodeType: AtcFederationNodeType
  ownerServerId: string
  nodeNonce: string
  regionId?: string | undefined
  address?: string | undefined
  nodeData?: Record<string, unknown> | undefined
}

interface FederationNodeRow extends RowDataPacket {
  id: string
  node_id: string
  node_type: string
  status: string
  owner_server_id: string
  region_id: string | null
  address: string | null
  node_nonce: string
  node_data: string | null
  joined_at: Date
  left_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: FederationNodeRow): AtcFederationNode {
  let nodeData: Record<string, unknown> = {}
  if (row.node_data) {
    try { nodeData = JSON.parse(row.node_data) as Record<string, unknown> } catch { nodeData = {} }
  }
  return {
    id: row.id,
    nodeId: row.node_id,
    nodeType: row.node_type as AtcFederationNodeType,
    status: row.status as AtcFederationNodeStatus,
    ownerServerId: row.owner_server_id,
    regionId: row.region_id,
    address: row.address,
    nodeNonce: row.node_nonce,
    nodeData,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class FederationNodeRepository {
  constructor(private readonly pool: FederationRuntimePool) {}

  async register(params: RegisterFederationNodeParams): Promise<AtcFederationNode> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const nodeId = generateId()
      const nodeDataJson = JSON.stringify(params.nodeData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_federation_nodes
             (id, node_id, node_type, status, owner_server_id, region_id, address, node_nonce,
              node_data, joined_at, left_at, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, NOW(3), NULL, NOW(3), NOW(3))`,
          [id, nodeId, params.nodeType, params.ownerServerId,
           params.regionId ?? null, params.address ?? null, params.nodeNonce, nodeDataJson] as (string | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateFederationNodeError(params.nodeNonce)
        throw err
      }

      const [rows] = await conn.execute<FederationNodeRow[]>(
        `SELECT id, node_id, node_type, status, owner_server_id, region_id, address, node_nonce,
                node_data, joined_at, left_at, created_at, updated_at
         FROM atc_federation_nodes WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Federation node not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcFederationNode | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FederationNodeRow[]>(
        `SELECT id, node_id, node_type, status, owner_server_id, region_id, address, node_nonce,
                node_data, joined_at, left_at, created_at, updated_at
         FROM atc_federation_nodes WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcFederationNodeStatus, leftAt?: Date | undefined): Promise<AtcFederationNode> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<FederationNodeRow[]>(
          `SELECT id, node_id, node_type, status, owner_server_id, region_id, address, node_nonce,
                  node_data, joined_at, left_at, created_at, updated_at
           FROM atc_federation_nodes WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new FederationNodeNotFoundError(id)

        if (leftAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_federation_nodes SET status = ?, left_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, leftAt.toISOString().replace('T', ' ').replace('Z', ''), id] as string[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_federation_nodes SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id]
          )
        }

        const [rows] = await conn.execute<FederationNodeRow[]>(
          `SELECT id, node_id, node_type, status, owner_server_id, region_id, address, node_nonce,
                  node_data, joined_at, left_at, created_at, updated_at
           FROM atc_federation_nodes WHERE id = ? LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new FederationNodeNotFoundError(id)
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

  async listActive(regionId?: string | undefined): Promise<AtcFederationNode[]> {
    const conn = await this.pool.getConnection()
    try {
      if (regionId !== undefined) {
        const [rows] = await conn.execute<FederationNodeRow[]>(
          `SELECT id, node_id, node_type, status, owner_server_id, region_id, address, node_nonce,
                  node_data, joined_at, left_at, created_at, updated_at
           FROM atc_federation_nodes WHERE status = 'active' AND region_id = ? ORDER BY joined_at ASC`,
          [regionId]
        )
        return rows.map(mapRow)
      }
      const [rows] = await conn.execute<FederationNodeRow[]>(
        `SELECT id, node_id, node_type, status, owner_server_id, region_id, address, node_nonce,
                node_data, joined_at, left_at, created_at, updated_at
         FROM atc_federation_nodes WHERE status = 'active' ORDER BY joined_at ASC`
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
        `DELETE FROM atc_federation_nodes
         WHERE status IN ('offline')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
