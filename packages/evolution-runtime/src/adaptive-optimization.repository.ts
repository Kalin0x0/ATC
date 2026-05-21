import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EvolutionRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { OptimizationNotFoundError, DuplicateOptimizationError } from './errors.js'

export type AtcOptimizationType = 'cpu' | 'memory' | 'latency' | 'throughput' | 'concurrency' | 'custom'
export type AtcOptimizationStatus = 'pending' | 'active' | 'completed' | 'failed'

export interface AtcAdaptiveOptimization {
  id: string
  optimizationId: string
  optimizationType: AtcOptimizationType
  status: AtcOptimizationStatus
  ownerServerId: string
  targetNode: string
  optimizationNonce: string
  optimizationData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateAdaptiveOptimizationParams {
  optimizationType: AtcOptimizationType
  ownerServerId: string
  targetNode: string
  optimizationNonce: string
  optimizationData?: Record<string, unknown> | undefined
}

interface AdaptiveOptimizationRow extends RowDataPacket {
  id: string
  optimization_id: string
  optimization_type: string
  status: string
  owner_server_id: string
  target_node: string
  optimization_nonce: string
  optimization_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: AdaptiveOptimizationRow): AtcAdaptiveOptimization {
  let optimizationData: Record<string, unknown> = {}
  if (row.optimization_data) {
    try { optimizationData = JSON.parse(row.optimization_data) as Record<string, unknown> } catch { optimizationData = {} }
  }
  return {
    id: row.id,
    optimizationId: row.optimization_id,
    optimizationType: row.optimization_type as AtcOptimizationType,
    status: row.status as AtcOptimizationStatus,
    ownerServerId: row.owner_server_id,
    targetNode: row.target_node,
    optimizationNonce: row.optimization_nonce,
    optimizationData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class AdaptiveOptimizationRepository {
  constructor(private readonly pool: EvolutionRuntimePool) {}

  async create(params: CreateAdaptiveOptimizationParams): Promise<AtcAdaptiveOptimization> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const optimizationId = generateId()
      const optimizationDataJson = JSON.stringify(params.optimizationData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_adaptive_optimization
             (id, optimization_id, optimization_type, status, owner_server_id, target_node,
              optimization_nonce, optimization_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [id, optimizationId, params.optimizationType, params.ownerServerId,
           params.targetNode, params.optimizationNonce, optimizationDataJson] as string[],
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateOptimizationError(params.optimizationNonce)
        throw err
      }

      const [rows] = await conn.execute<AdaptiveOptimizationRow[]>(
        `SELECT id, optimization_id, optimization_type, status, owner_server_id, target_node,
                optimization_nonce, optimization_data, completed_at, created_at, updated_at
         FROM atc_adaptive_optimization WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new OptimizationNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcAdaptiveOptimization | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AdaptiveOptimizationRow[]>(
        `SELECT id, optimization_id, optimization_type, status, owner_server_id, target_node,
                optimization_nonce, optimization_data, completed_at, created_at, updated_at
         FROM atc_adaptive_optimization WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcOptimizationStatus, completedAt?: Date | undefined): Promise<AtcAdaptiveOptimization> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<AdaptiveOptimizationRow[]>(
          `SELECT id FROM atc_adaptive_optimization WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        const lockRow = lockRows[0]
        if (!lockRow) throw new OptimizationNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_adaptive_optimization SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as string[],
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_adaptive_optimization SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id],
          )
        }

        const [rows] = await conn.execute<AdaptiveOptimizationRow[]>(
          `SELECT id, optimization_id, optimization_type, status, owner_server_id, target_node,
                  optimization_nonce, optimization_data, completed_at, created_at, updated_at
           FROM atc_adaptive_optimization WHERE id = ? LIMIT 1`,
          [id],
        )
        const row = rows[0]
        if (!row) throw new OptimizationNotFoundError(id)
        await conn.commit()
        return mapRow(row)
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
        `DELETE FROM atc_adaptive_optimization
         WHERE status IN ('completed', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
