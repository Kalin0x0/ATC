import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EvolutionRuntimePool } from './pool.js'
import { generateId } from './id.js'

export type AtcDistributedOptType = 'load_balance' | 'shard_rebalance' | 'cache_warm' | 'route_optimize' | 'custom'
export type AtcDistributedOptStatus = 'active' | 'idle' | 'overloaded' | 'failed'

export interface AtcDistributedOptimization {
  id: string
  nodeId: string
  optType: AtcDistributedOptType
  status: AtcDistributedOptStatus
  ownerServerId: string
  optData: Record<string, unknown>
  lastOptimizedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertDistributedOptimizationParams {
  nodeId: string
  optType: AtcDistributedOptType
  ownerServerId: string
  optData?: Record<string, unknown> | undefined
}

interface DistributedOptimizationRow extends RowDataPacket {
  id: string
  node_id: string
  opt_type: string
  status: string
  owner_server_id: string
  opt_data: string | null
  last_optimized_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: DistributedOptimizationRow): AtcDistributedOptimization {
  let optData: Record<string, unknown> = {}
  if (row.opt_data) {
    try { optData = JSON.parse(row.opt_data) as Record<string, unknown> } catch { optData = {} }
  }
  return {
    id: row.id,
    nodeId: row.node_id,
    optType: row.opt_type as AtcDistributedOptType,
    status: row.status as AtcDistributedOptStatus,
    ownerServerId: row.owner_server_id,
    optData,
    lastOptimizedAt: row.last_optimized_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class DistributedOptimizationRepository {
  constructor(private readonly pool: EvolutionRuntimePool) {}

  async upsert(params: UpsertDistributedOptimizationParams): Promise<AtcDistributedOptimization> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const optDataJson = JSON.stringify(params.optData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_distributed_optimization
           (id, node_id, opt_type, status, owner_server_id, opt_data, last_optimized_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           opt_type = VALUES(opt_type),
           status = 'active',
           opt_data = VALUES(opt_data),
           last_optimized_at = NOW(3),
           updated_at = NOW(3)`,
        [id, params.nodeId, params.optType, params.ownerServerId, optDataJson] as string[],
      )

      const [rows] = await conn.execute<DistributedOptimizationRow[]>(
        `SELECT id, node_id, opt_type, status, owner_server_id, opt_data, last_optimized_at, created_at, updated_at
         FROM atc_distributed_optimization WHERE node_id = ? LIMIT 1`,
        [params.nodeId],
      )
      const row = rows[0]
      if (!row) throw new Error(`Distributed optimization not found after upsert: ${params.nodeId}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findByNode(nodeId: string): Promise<AtcDistributedOptimization | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DistributedOptimizationRow[]>(
        `SELECT id, node_id, opt_type, status, owner_server_id, opt_data, last_optimized_at, created_at, updated_at
         FROM atc_distributed_optimization WHERE node_id = ? LIMIT 1`,
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
        const [lockRows] = await conn.execute<DistributedOptimizationRow[]>(
          `SELECT id FROM atc_distributed_optimization WHERE node_id = ? LIMIT 1 FOR UPDATE`,
          [nodeId],
        )
        const lockRow = lockRows[0]
        if (!lockRow) {
          await conn.rollback()
          return
        }

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_distributed_optimization SET status = 'failed', updated_at = NOW(3) WHERE node_id = ?`,
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
        `DELETE FROM atc_distributed_optimization
         WHERE status IN ('idle', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
