import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ClusterRuntimePool } from './pool.js'
import { generateId } from './id.js'

export type AtcLifecycleType = 'standard' | 'rolling' | 'graceful' | 'forced' | 'custom'
export type AtcLifecycleStatus = 'active' | 'draining' | 'stopped' | 'failed'

export interface AtcNodeLifecycle {
  id: string
  nodeId: string
  lifecycleType: AtcLifecycleType
  status: AtcLifecycleStatus
  isActive: boolean
  ownerServerId: string
  lifecycleData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface UpsertLifecycleParams {
  nodeId: string
  lifecycleType: AtcLifecycleType
  ownerServerId: string
  status?: AtcLifecycleStatus | undefined
  lifecycleData?: Record<string, unknown> | undefined
}

interface LifecycleRow extends RowDataPacket {
  id: string
  node_id: string
  lifecycle_type: string
  status: string
  is_active: number
  owner_server_id: string
  lifecycle_data: string | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: LifecycleRow): AtcNodeLifecycle {
  let lifecycleData: Record<string, unknown> = {}
  if (row.lifecycle_data) {
    try { lifecycleData = JSON.parse(row.lifecycle_data) as Record<string, unknown> } catch { lifecycleData = {} }
  }
  return {
    id: row.id,
    nodeId: row.node_id,
    lifecycleType: row.lifecycle_type as AtcLifecycleType,
    status: row.status as AtcLifecycleStatus,
    isActive: row.is_active === 1,
    ownerServerId: row.owner_server_id,
    lifecycleData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class NodeLifecycleRepository {
  constructor(private readonly pool: ClusterRuntimePool) {}

  async upsert(params: UpsertLifecycleParams): Promise<AtcNodeLifecycle> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const status = params.status ?? 'active'
      const lifecycleDataJson = JSON.stringify(params.lifecycleData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_node_lifecycle
           (id, node_id, lifecycle_type, status, is_active, owner_server_id, lifecycle_data, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           lifecycle_type = VALUES(lifecycle_type),
           status = VALUES(status),
           is_active = 1,
           owner_server_id = VALUES(owner_server_id),
           lifecycle_data = VALUES(lifecycle_data),
           updated_at = NOW(3)`,
        [id, params.nodeId, params.lifecycleType, status,
         params.ownerServerId, lifecycleDataJson] as string[]
      )

      const [rows] = await conn.execute<LifecycleRow[]>(
        `SELECT id, node_id, lifecycle_type, status, is_active, owner_server_id, lifecycle_data, created_at, updated_at
         FROM atc_node_lifecycle WHERE node_id = ? LIMIT 1`,
        [params.nodeId]
      )
      if (!rows[0]) throw new Error(`Lifecycle not found after upsert: ${params.nodeId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByNodeId(nodeId: string): Promise<AtcNodeLifecycle | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<LifecycleRow[]>(
        `SELECT id, node_id, lifecycle_type, status, is_active, owner_server_id, lifecycle_data, created_at, updated_at
         FROM atc_node_lifecycle WHERE node_id = ? LIMIT 1`,
        [nodeId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async deactivate(nodeId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<ResultSetHeader>(
        `UPDATE atc_node_lifecycle SET is_active = 0, status = 'stopped', updated_at = NOW(3) WHERE node_id = ?`,
        [nodeId]
      )
    } finally {
      conn.release()
    }
  }
}
