import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ClusterRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { ScalingNotFoundError, DuplicateScalingError } from './errors.js'

export type AtcScalingType = 'scale_up' | 'scale_down' | 'rebalance' | 'eviction' | 'custom'
export type AtcScalingStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface AtcClusterScaling {
  id: string
  scalingId: string
  scalingType: AtcScalingType
  targetCount: number
  status: AtcScalingStatus
  ownerServerId: string
  scalingNonce: string
  scalingData: Record<string, unknown>
  startedAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateScalingParams {
  scalingType: AtcScalingType
  targetCount: number
  ownerServerId: string
  scalingNonce: string
  scalingData?: Record<string, unknown> | undefined
}

interface ScalingRow extends RowDataPacket {
  id: string
  scaling_id: string
  scaling_type: string
  target_count: number
  status: string
  owner_server_id: string
  scaling_nonce: string
  scaling_data: string | null
  started_at: Date
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: ScalingRow): AtcClusterScaling {
  let scalingData: Record<string, unknown> = {}
  if (row.scaling_data) {
    try { scalingData = JSON.parse(row.scaling_data) as Record<string, unknown> } catch { scalingData = {} }
  }
  return {
    id: row.id,
    scalingId: row.scaling_id,
    scalingType: row.scaling_type as AtcScalingType,
    targetCount: row.target_count,
    status: row.status as AtcScalingStatus,
    ownerServerId: row.owner_server_id,
    scalingNonce: row.scaling_nonce,
    scalingData,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ClusterScalingRepository {
  constructor(private readonly pool: ClusterRuntimePool) {}

  async create(params: CreateScalingParams): Promise<AtcClusterScaling> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const scalingId = generateId()
      const scalingDataJson = JSON.stringify(params.scalingData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_cluster_scaling
             (id, scaling_id, scaling_type, target_count, status, owner_server_id,
              scaling_nonce, scaling_data, started_at, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, NOW(3), NULL, NOW(3), NOW(3))`,
          [id, scalingId, params.scalingType, params.targetCount,
           params.ownerServerId, params.scalingNonce, scalingDataJson] as (string | number)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateScalingError(params.scalingNonce)
        throw err
      }

      const [rows] = await conn.execute<ScalingRow[]>(
        `SELECT id, scaling_id, scaling_type, target_count, status, owner_server_id,
                scaling_nonce, scaling_data, started_at, completed_at, created_at, updated_at
         FROM atc_cluster_scaling WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Scaling not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcClusterScaling | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ScalingRow[]>(
        `SELECT id, scaling_id, scaling_type, target_count, status, owner_server_id,
                scaling_nonce, scaling_data, started_at, completed_at, created_at, updated_at
         FROM atc_cluster_scaling WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcScalingStatus,
    completedAt?: Date | undefined
  ): Promise<AtcClusterScaling> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ScalingRow[]>(
          `SELECT id, scaling_id, scaling_type, target_count, status, owner_server_id,
                  scaling_nonce, scaling_data, started_at, completed_at, created_at, updated_at
           FROM atc_cluster_scaling WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new ScalingNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_cluster_scaling SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as string[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_cluster_scaling SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id]
          )
        }

        const [rows] = await conn.execute<ScalingRow[]>(
          `SELECT id, scaling_id, scaling_type, target_count, status, owner_server_id,
                  scaling_nonce, scaling_data, started_at, completed_at, created_at, updated_at
           FROM atc_cluster_scaling WHERE id = ? LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new ScalingNotFoundError(id)
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
}
