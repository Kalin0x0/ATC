import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { MetaRuntimePool } from './pool.js'
import { generateId } from './id.js'

export type AtcCoordinationType = 'leader' | 'follower' | 'observer' | 'standby' | 'custom'
export type AtcCoordinationStatus = 'active' | 'inactive' | 'failed'

export interface AtcRuntimeCoordination {
  id: string
  nodeId: string
  coordinationType: AtcCoordinationType
  status: AtcCoordinationStatus
  ownerServerId: string
  coordinationData: Record<string, unknown>
  heartbeatAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertRuntimeCoordinationParams {
  nodeId: string
  coordinationType: AtcCoordinationType
  ownerServerId: string
  coordinationData?: Record<string, unknown> | undefined
}

interface RuntimeCoordinationRow extends RowDataPacket {
  id: string
  node_id: string
  coordination_type: string
  status: string
  owner_server_id: string
  coordination_data: string | null
  heartbeat_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeCoordinationRow): AtcRuntimeCoordination {
  let coordinationData: Record<string, unknown> = {}
  if (row.coordination_data) {
    try { coordinationData = JSON.parse(row.coordination_data) as Record<string, unknown> } catch { coordinationData = {} }
  }
  return {
    id: row.id,
    nodeId: row.node_id,
    coordinationType: row.coordination_type as AtcCoordinationType,
    status: row.status as AtcCoordinationStatus,
    ownerServerId: row.owner_server_id,
    coordinationData,
    heartbeatAt: row.heartbeat_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeCoordinationRepository {
  constructor(private readonly pool: MetaRuntimePool) {}

  async upsert(params: UpsertRuntimeCoordinationParams): Promise<AtcRuntimeCoordination> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const coordinationDataJson = JSON.stringify(params.coordinationData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_runtime_coordination
           (id, node_id, coordination_type, status, owner_server_id, coordination_data,
            heartbeat_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           coordination_type = VALUES(coordination_type),
           status = 'active',
           owner_server_id = VALUES(owner_server_id),
           coordination_data = VALUES(coordination_data),
           heartbeat_at = NOW(3),
           updated_at = NOW(3)`,
        [id, params.nodeId, params.coordinationType, params.ownerServerId, coordinationDataJson] as string[],
      )

      const [rows] = await conn.execute<RuntimeCoordinationRow[]>(
        `SELECT id, node_id, coordination_type, status, owner_server_id, coordination_data,
                heartbeat_at, created_at, updated_at
         FROM atc_runtime_coordination WHERE node_id = ? LIMIT 1`,
        [params.nodeId],
      )
      const row = rows[0]
      if (!row) throw new Error(`Coordination not found after upsert: ${params.nodeId}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findByNode(nodeId: string): Promise<AtcRuntimeCoordination | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeCoordinationRow[]>(
        `SELECT id, node_id, coordination_type, status, owner_server_id, coordination_data,
                heartbeat_at, created_at, updated_at
         FROM atc_runtime_coordination WHERE node_id = ? LIMIT 1`,
        [nodeId],
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async failNode(nodeId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeCoordinationRow[]>(
          `SELECT id FROM atc_runtime_coordination WHERE node_id = ? LIMIT 1 FOR UPDATE`,
          [nodeId],
        )
        const lockRow = lockRows[0]
        if (!lockRow) {
          await conn.rollback()
          return
        }

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_runtime_coordination SET status = 'failed', updated_at = NOW(3) WHERE node_id = ?`,
          [nodeId],
        )
        await conn.commit()
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
        `DELETE FROM atc_runtime_coordination
         WHERE status = 'failed'
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
