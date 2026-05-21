import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { WorldIntegrityPool } from './pool.js'
import { generateId } from './id.js'
import { ConsistencyNotFoundError } from './errors.js'

export type AtcConsistencyType = 'eventual' | 'strong' | 'causal' | 'sequential' | 'custom'
export type AtcConsistencyStatus = 'consistent' | 'diverged' | 'reconciling' | 'unknown'

export interface AtcRuntimeConsistency {
  id: string
  nodeId: string
  consistencyType: AtcConsistencyType
  status: AtcConsistencyStatus
  ownerServerId: string
  consistencyData: Record<string, unknown>
  checkedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertConsistencyParams {
  nodeId: string
  consistencyType: AtcConsistencyType
  ownerServerId: string
  consistencyData?: Record<string, unknown> | undefined
}

interface RuntimeConsistencyRow extends RowDataPacket {
  id: string
  node_id: string
  consistency_type: string
  status: string
  owner_server_id: string
  consistency_data: string | null
  checked_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeConsistencyRow): AtcRuntimeConsistency {
  let consistencyData: Record<string, unknown> = {}
  if (row.consistency_data) {
    try {
      consistencyData = JSON.parse(row.consistency_data) as Record<string, unknown>
    } catch {
      consistencyData = {}
    }
  }
  return {
    id: row.id,
    nodeId: row.node_id,
    consistencyType: row.consistency_type as AtcConsistencyType,
    status: row.status as AtcConsistencyStatus,
    ownerServerId: row.owner_server_id,
    consistencyData,
    checkedAt: row.checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeConsistencyRepository {
  constructor(private readonly pool: WorldIntegrityPool) {}

  async upsert(params: UpsertConsistencyParams): Promise<AtcRuntimeConsistency> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const consistencyDataJson = JSON.stringify(params.consistencyData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_runtime_consistency
           (id, node_id, consistency_type, status, owner_server_id,
            consistency_data, checked_at, created_at, updated_at)
         VALUES (?, ?, ?, 'consistent', ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           consistency_type = VALUES(consistency_type),
           status = 'consistent',
           consistency_data = VALUES(consistency_data),
           checked_at = NOW(3),
           updated_at = NOW(3)`,
        [
          id,
          params.nodeId,
          params.consistencyType,
          params.ownerServerId,
          consistencyDataJson,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<RuntimeConsistencyRow[]>(
        `SELECT id, node_id, consistency_type, status, owner_server_id,
                consistency_data, checked_at, created_at, updated_at
         FROM atc_runtime_consistency
         WHERE node_id = ?
         LIMIT 1`,
        [params.nodeId]
      )
      if (!rows[0]) throw new Error(`Runtime consistency record not found after upsert: ${params.nodeId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByNodeId(nodeId: string): Promise<AtcRuntimeConsistency | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeConsistencyRow[]>(
        `SELECT id, node_id, consistency_type, status, owner_server_id,
                consistency_data, checked_at, created_at, updated_at
         FROM atc_runtime_consistency
         WHERE node_id = ?
         LIMIT 1`,
        [nodeId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async markDiverged(nodeId: string): Promise<AtcRuntimeConsistency> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeConsistencyRow[]>(
          `SELECT id, node_id, consistency_type, status, owner_server_id,
                  consistency_data, checked_at, created_at, updated_at
           FROM atc_runtime_consistency
           WHERE node_id = ?
           LIMIT 1
           FOR UPDATE`,
          [nodeId]
        )
        if (!lockRows[0]) throw new ConsistencyNotFoundError(nodeId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_runtime_consistency
           SET status = 'diverged', updated_at = NOW(3)
           WHERE node_id = ?`,
          [nodeId] as (string | number | boolean | null)[]
        )

        const [rows] = await conn.execute<RuntimeConsistencyRow[]>(
          `SELECT id, node_id, consistency_type, status, owner_server_id,
                  consistency_data, checked_at, created_at, updated_at
           FROM atc_runtime_consistency
           WHERE node_id = ?
           LIMIT 1`,
          [nodeId]
        )
        if (!rows[0]) throw new ConsistencyNotFoundError(nodeId)

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
        `DELETE FROM atc_runtime_consistency
         WHERE status IN ('diverged', 'unknown')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
