import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'
import type { FactionPool } from './pool.js'
import { generateId } from './id.js'
import { ResourceNodeNotFoundError, ResourceNodeAlreadyOwnedError } from './errors.js'

export type AtcResourceNodeType = 'mine' | 'oil_field' | 'farm' | 'dock' | 'warehouse' | 'lab' | 'safehouse' | 'other'

export interface AtcResourceNode {
  id: string
  nodeId: string
  label: string
  nodeType: AtcResourceNodeType
  controllingFactionId: string | null
  yieldRate: number
  isActive: boolean
  centerX: number | null
  centerY: number | null
  centerZ: number | null
  lastCapturedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface ResourceNodeRow extends RowDataPacket {
  id: string
  node_id: string
  label: string
  node_type: string
  controlling_faction_id: string | null
  yield_rate: string
  is_active: number
  center_x: string | null
  center_y: string | null
  center_z: string | null
  last_captured_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToNode(row: ResourceNodeRow): AtcResourceNode {
  return {
    id: row.id,
    nodeId: row.node_id,
    label: row.label,
    nodeType: row.node_type as AtcResourceNodeType,
    controllingFactionId: row.controlling_faction_id,
    yieldRate: Number(row.yield_rate),
    isActive: row.is_active === 1,
    centerX: row.center_x !== null ? Number(row.center_x) : null,
    centerY: row.center_y !== null ? Number(row.center_y) : null,
    centerZ: row.center_z !== null ? Number(row.center_z) : null,
    lastCapturedAt: row.last_captured_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateResourceNodeParams {
  nodeId: string
  label: string
  nodeType: AtcResourceNodeType
  yieldRate?: number
  centerX?: number | null | undefined
  centerY?: number | null | undefined
  centerZ?: number | null | undefined
}

export class ResourceNodeRepository {
  constructor(private readonly pool: FactionPool) {}

  async create(params: CreateResourceNodeParams): Promise<AtcResourceNode> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const yieldRate = params.yieldRate ?? 1.0
      const centerX = params.centerX ?? null
      const centerY = params.centerY ?? null
      const centerZ = params.centerZ ?? null
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_resource_nodes
             (id, node_id, label, node_type, controlling_faction_id, yield_rate, is_active, center_x, center_y, center_z, last_captured_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, ?, 1, ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [id, params.nodeId, params.label, params.nodeType, yieldRate, centerX, centerY, centerZ],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          const existing = await this.findByNodeId(params.nodeId)
          if (existing) return existing
        }
        throw err
      }
      const [rows] = await conn.execute<ResourceNodeRow[]>(
        'SELECT * FROM atc_resource_nodes WHERE id = ? LIMIT 1',
        [id],
      )
      return rowToNode(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcResourceNode | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ResourceNodeRow[]>(
        'SELECT * FROM atc_resource_nodes WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToNode(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByNodeId(nodeId: string): Promise<AtcResourceNode | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ResourceNodeRow[]>(
        'SELECT * FROM atc_resource_nodes WHERE node_id = ? LIMIT 1',
        [nodeId],
      )
      return rows[0] ? rowToNode(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcResourceNode[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ResourceNodeRow[]>(
        'SELECT * FROM atc_resource_nodes ORDER BY label ASC',
      )
      return rows.map(rowToNode)
    } finally {
      conn.release()
    }
  }

  async listByFaction(factionId: string): Promise<AtcResourceNode[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ResourceNodeRow[]>(
        'SELECT * FROM atc_resource_nodes WHERE controlling_faction_id = ? ORDER BY label ASC',
        [factionId],
      )
      return rows.map(rowToNode)
    } finally {
      conn.release()
    }
  }

  async capture(id: string, factionId: string, conn?: PoolConnection): Promise<AtcResourceNode> {
    const ownConn = conn === undefined
    const c = ownConn ? await this.pool.getConnection() : conn
    try {
      if (ownConn) await c.beginTransaction()

      const [rows] = await c.execute<ResourceNodeRow[]>(
        'SELECT * FROM atc_resource_nodes WHERE id = ? FOR UPDATE',
        [id],
      )
      const row = rows[0]
      if (!row) {
        if (ownConn) await c.rollback()
        throw new ResourceNodeNotFoundError(id)
      }

      if (row.controlling_faction_id === factionId) {
        if (ownConn) await c.rollback()
        throw new ResourceNodeAlreadyOwnedError(id, factionId)
      }

      await c.execute(
        'UPDATE atc_resource_nodes SET controlling_faction_id = ?, last_captured_at = NOW(3), updated_at = NOW(3) WHERE id = ?',
        [factionId, id],
      )

      const [updated] = await c.execute<ResourceNodeRow[]>(
        'SELECT * FROM atc_resource_nodes WHERE id = ? LIMIT 1',
        [id],
      )
      if (ownConn) await c.commit()
      return rowToNode(updated[0]!)
    } catch (err) {
      if (ownConn) { try { await c.rollback() } catch { /* ignore */ } }
      throw err
    } finally {
      if (ownConn) c.release()
    }
  }

  async release(id: string, conn?: PoolConnection): Promise<void> {
    const ownConn = conn === undefined
    const c = ownConn ? await this.pool.getConnection() : conn
    try {
      await c.execute(
        'UPDATE atc_resource_nodes SET controlling_faction_id = NULL, updated_at = NOW(3) WHERE id = ?',
        [id],
      )
    } finally {
      if (ownConn) c.release()
    }
  }
}
