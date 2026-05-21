import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReplicationRuntimePool } from './pool.js'
import { generateId } from './id.js'

export type AtcSpatialNodeType = 'server' | 'zone' | 'region' | 'partition' | 'custom'

export interface AtcSpatialNode {
  id: string
  nodeId: string
  nodeType: AtcSpatialNodeType
  ownerServerId: string | null
  regionId: string | null
  positionData: Record<string, unknown>
  lastTickAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertSpatialNodeParams {
  nodeId: string
  nodeType: AtcSpatialNodeType
  ownerServerId?: string | undefined
  regionId?: string | undefined
  positionData?: Record<string, unknown> | undefined
}

interface SpatialNodeRow extends RowDataPacket {
  id: string
  node_id: string
  node_type: string
  owner_server_id: string | null
  region_id: string | null
  position_data: string | null
  last_tick_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: SpatialNodeRow): AtcSpatialNode {
  let positionData: Record<string, unknown> = {}
  if (row.position_data) {
    try {
      positionData = JSON.parse(row.position_data) as Record<string, unknown>
    } catch {
      positionData = {}
    }
  }
  return {
    id: row.id,
    nodeId: row.node_id,
    nodeType: row.node_type as AtcSpatialNodeType,
    ownerServerId: row.owner_server_id,
    regionId: row.region_id,
    positionData,
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SpatialNodeRepository {
  constructor(private readonly pool: ReplicationRuntimePool) {}

  async findByNodeId(nodeId: string): Promise<AtcSpatialNode | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SpatialNodeRow[]>(
        `SELECT id, node_id, node_type, owner_server_id, region_id, position_data, last_tick_at, created_at, updated_at
         FROM atc_spatial_nodes
         WHERE node_id = ?
         LIMIT 1`,
        [nodeId]
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async upsert(params: UpsertSpatialNodeParams): Promise<AtcSpatialNode> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const positionDataJson = JSON.stringify(params.positionData ?? {})
      const ownerServerId = params.ownerServerId ?? null
      const regionId = params.regionId ?? null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_spatial_nodes
           (id, node_id, node_type, owner_server_id, region_id, position_data, last_tick_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           node_type = VALUES(node_type),
           owner_server_id = VALUES(owner_server_id),
           region_id = VALUES(region_id),
           position_data = VALUES(position_data),
           last_tick_at = NOW(3),
           updated_at = NOW(3)`,
        [id, params.nodeId, params.nodeType, ownerServerId, regionId, positionDataJson]
      )

      const [rows] = await conn.execute<SpatialNodeRow[]>(
        `SELECT id, node_id, node_type, owner_server_id, region_id, position_data, last_tick_at, created_at, updated_at
         FROM atc_spatial_nodes
         WHERE node_id = ?
         LIMIT 1`,
        [params.nodeId]
      )
      const row = rows[0]
      if (!row) throw new Error(`Spatial node not found after upsert: ${params.nodeId}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async listByServerId(serverId: string): Promise<AtcSpatialNode[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SpatialNodeRow[]>(
        `SELECT id, node_id, node_type, owner_server_id, region_id, position_data, last_tick_at, created_at, updated_at
         FROM atc_spatial_nodes
         WHERE owner_server_id = ?
         ORDER BY created_at ASC`,
        [serverId]
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcSpatialNode[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SpatialNodeRow[]>(
        `SELECT id, node_id, node_type, owner_server_id, region_id, position_data, last_tick_at, created_at, updated_at
         FROM atc_spatial_nodes
         ORDER BY created_at ASC`
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async deleteStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_spatial_nodes
         WHERE last_tick_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
