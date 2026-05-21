import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { CoreFinalizationPool } from './pool.js'
import { generateId } from './id.js'
import { FinalizationNotFoundError } from './errors.js'

export type AtcFinalizationCoordinationType = 'distributed' | 'cascading' | 'parallel' | 'sequential' | 'custom'
export type AtcFinalizationCoordinationStatus = 'active' | 'completing' | 'completed' | 'failed'

export interface AtcFinalizationCoordination {
  id: string
  coordinationId: string
  coordinationType: AtcFinalizationCoordinationType
  status: AtcFinalizationCoordinationStatus
  ownerServerId: string
  coordinationData: Record<string, unknown>
  syncedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertFinalizationCoordinationParams {
  coordinationId: string
  coordinationType: AtcFinalizationCoordinationType
  ownerServerId: string
  coordinationData?: Record<string, unknown> | undefined
}

interface FinalizationCoordinationRow extends RowDataPacket {
  id: string
  coordination_id: string
  coordination_type: string
  status: string
  owner_server_id: string
  coordination_data: string | null
  synced_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: FinalizationCoordinationRow): AtcFinalizationCoordination {
  let coordinationData: Record<string, unknown> = {}
  if (row.coordination_data) {
    try {
      coordinationData = JSON.parse(row.coordination_data) as Record<string, unknown>
    } catch {
      coordinationData = {}
    }
  }
  return {
    id: row.id,
    coordinationId: row.coordination_id,
    coordinationType: row.coordination_type as AtcFinalizationCoordinationType,
    status: row.status as AtcFinalizationCoordinationStatus,
    ownerServerId: row.owner_server_id,
    coordinationData,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class FinalizationCoordinationRepository {
  constructor(private readonly pool: CoreFinalizationPool) {}

  async upsert(params: UpsertFinalizationCoordinationParams): Promise<AtcFinalizationCoordination> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const coordinationDataJson = JSON.stringify(params.coordinationData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_finalization_coordination
           (id, coordination_id, coordination_type, status, owner_server_id,
            coordination_data, synced_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           coordination_type = VALUES(coordination_type),
           status = 'active',
           owner_server_id = VALUES(owner_server_id),
           coordination_data = VALUES(coordination_data),
           synced_at = NOW(3),
           updated_at = NOW(3)`,
        [
          id,
          params.coordinationId,
          params.coordinationType,
          params.ownerServerId,
          coordinationDataJson,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<FinalizationCoordinationRow[]>(
        `SELECT id, coordination_id, coordination_type, status, owner_server_id,
                coordination_data, synced_at, created_at, updated_at
         FROM atc_finalization_coordination
         WHERE coordination_id = ?
         LIMIT 1`,
        [params.coordinationId]
      )
      if (!rows[0]) throw new Error(`Finalization coordination record not found after upsert: ${params.coordinationId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByCoordinationId(coordinationId: string): Promise<AtcFinalizationCoordination | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FinalizationCoordinationRow[]>(
        `SELECT id, coordination_id, coordination_type, status, owner_server_id,
                coordination_data, synced_at, created_at, updated_at
         FROM atc_finalization_coordination
         WHERE coordination_id = ?
         LIMIT 1`,
        [coordinationId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcFinalizationCoordinationStatus
  ): Promise<AtcFinalizationCoordination> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<FinalizationCoordinationRow[]>(
          `SELECT id, coordination_id, coordination_type, status, owner_server_id,
                  coordination_data, synced_at, created_at, updated_at
           FROM atc_finalization_coordination
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new FinalizationNotFoundError(id)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_finalization_coordination
           SET status = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [status, id] as (string | number | boolean | null)[]
        )

        const [rows] = await conn.execute<FinalizationCoordinationRow[]>(
          `SELECT id, coordination_id, coordination_type, status, owner_server_id,
                  coordination_data, synced_at, created_at, updated_at
           FROM atc_finalization_coordination
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new FinalizationNotFoundError(id)

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
        `DELETE FROM atc_finalization_coordination
         WHERE status IN ('completed', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
