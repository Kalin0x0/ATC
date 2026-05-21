import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { SovereigntyRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { ClusterContinuityNotFoundError } from './errors.js'

export type AtcClusterType = 'primary' | 'replica' | 'observer' | 'arbiter' | 'custom'
export type AtcClusterStatus = 'active' | 'degraded' | 'recovering' | 'offline' | 'failed'

export interface AtcClusterContinuity {
  id: string
  clusterId: string
  clusterType: AtcClusterType
  status: AtcClusterStatus
  ownerServerId: string
  clusterData: Record<string, unknown>
  syncedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertClusterParams {
  clusterId: string
  clusterType: AtcClusterType
  ownerServerId: string
  clusterData?: Record<string, unknown> | undefined
}

interface ClusterContinuityRow extends RowDataPacket {
  id: string
  cluster_id: string
  cluster_type: string
  status: string
  owner_server_id: string
  cluster_data: string | null
  synced_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: ClusterContinuityRow): AtcClusterContinuity {
  let clusterData: Record<string, unknown> = {}
  if (row.cluster_data) {
    try {
      clusterData = JSON.parse(row.cluster_data) as Record<string, unknown>
    } catch {
      clusterData = {}
    }
  }
  return {
    id: row.id,
    clusterId: row.cluster_id,
    clusterType: row.cluster_type as AtcClusterType,
    status: row.status as AtcClusterStatus,
    ownerServerId: row.owner_server_id,
    clusterData,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ClusterContinuityRepository {
  constructor(private readonly pool: SovereigntyRuntimePool) {}

  async upsert(params: UpsertClusterParams): Promise<AtcClusterContinuity> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const clusterDataJson = JSON.stringify(params.clusterData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_cluster_continuity
           (id, cluster_id, cluster_type, status, owner_server_id,
            cluster_data, synced_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           cluster_type = VALUES(cluster_type),
           status = 'active',
           owner_server_id = VALUES(owner_server_id),
           cluster_data = VALUES(cluster_data),
           synced_at = NOW(3),
           updated_at = NOW(3)`,
        [
          id,
          params.clusterId,
          params.clusterType,
          params.ownerServerId,
          clusterDataJson,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<ClusterContinuityRow[]>(
        `SELECT id, cluster_id, cluster_type, status, owner_server_id,
                cluster_data, synced_at, created_at, updated_at
         FROM atc_cluster_continuity
         WHERE cluster_id = ?
         LIMIT 1`,
        [params.clusterId]
      )
      if (!rows[0]) throw new Error(`Cluster continuity record not found after upsert: ${params.clusterId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByClusterId(clusterId: string): Promise<AtcClusterContinuity | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ClusterContinuityRow[]>(
        `SELECT id, cluster_id, cluster_type, status, owner_server_id,
                cluster_data, synced_at, created_at, updated_at
         FROM atc_cluster_continuity
         WHERE cluster_id = ?
         LIMIT 1`,
        [clusterId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcClusterStatus
  ): Promise<AtcClusterContinuity> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ClusterContinuityRow[]>(
          `SELECT id, cluster_id, cluster_type, status, owner_server_id,
                  cluster_data, synced_at, created_at, updated_at
           FROM atc_cluster_continuity
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new ClusterContinuityNotFoundError(id)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_cluster_continuity
           SET status = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [status, id] as (string | number | boolean | null)[]
        )

        const [rows] = await conn.execute<ClusterContinuityRow[]>(
          `SELECT id, cluster_id, cluster_type, status, owner_server_id,
                  cluster_data, synced_at, created_at, updated_at
           FROM atc_cluster_continuity
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new ClusterContinuityNotFoundError(id)

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
        `DELETE FROM atc_cluster_continuity
         WHERE status IN ('offline', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
