import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { SovereigntyRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { SovereigntyNotFoundError } from './errors.js'

export type AtcSovereigntyCoordinationType = 'global' | 'regional' | 'cluster' | 'peer' | 'custom'
export type AtcSovereigntyCoordinationStatus = 'active' | 'suspended' | 'expired' | 'failed'

export interface AtcSovereigntyCoordination {
  id: string
  coordinationId: string
  coordinationType: AtcSovereigntyCoordinationType
  status: AtcSovereigntyCoordinationStatus
  ownerServerId: string
  coordinationData: Record<string, unknown>
  syncedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertSovereigntyCoordinationParams {
  coordinationId: string
  coordinationType: AtcSovereigntyCoordinationType
  ownerServerId: string
  coordinationData?: Record<string, unknown> | undefined
}

interface SovereigntyCoordinationRow extends RowDataPacket {
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

function mapRow(row: SovereigntyCoordinationRow): AtcSovereigntyCoordination {
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
    coordinationType: row.coordination_type as AtcSovereigntyCoordinationType,
    status: row.status as AtcSovereigntyCoordinationStatus,
    ownerServerId: row.owner_server_id,
    coordinationData,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SovereigntyCoordinationRepository {
  constructor(private readonly pool: SovereigntyRuntimePool) {}

  async upsert(params: UpsertSovereigntyCoordinationParams): Promise<AtcSovereigntyCoordination> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const coordinationDataJson = JSON.stringify(params.coordinationData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_sovereignty_coordination
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

      const [rows] = await conn.execute<SovereigntyCoordinationRow[]>(
        `SELECT id, coordination_id, coordination_type, status, owner_server_id,
                coordination_data, synced_at, created_at, updated_at
         FROM atc_sovereignty_coordination
         WHERE coordination_id = ?
         LIMIT 1`,
        [params.coordinationId]
      )
      if (!rows[0]) throw new Error(`Sovereignty coordination record not found after upsert: ${params.coordinationId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByCoordinationId(coordinationId: string): Promise<AtcSovereigntyCoordination | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SovereigntyCoordinationRow[]>(
        `SELECT id, coordination_id, coordination_type, status, owner_server_id,
                coordination_data, synced_at, created_at, updated_at
         FROM atc_sovereignty_coordination
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
    status: AtcSovereigntyCoordinationStatus
  ): Promise<AtcSovereigntyCoordination> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<SovereigntyCoordinationRow[]>(
          `SELECT id, coordination_id, coordination_type, status, owner_server_id,
                  coordination_data, synced_at, created_at, updated_at
           FROM atc_sovereignty_coordination
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new SovereigntyNotFoundError(id)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_sovereignty_coordination
           SET status = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [status, id] as (string | number | boolean | null)[]
        )

        const [rows] = await conn.execute<SovereigntyCoordinationRow[]>(
          `SELECT id, coordination_id, coordination_type, status, owner_server_id,
                  coordination_data, synced_at, created_at, updated_at
           FROM atc_sovereignty_coordination
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new SovereigntyNotFoundError(id)

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
        `DELETE FROM atc_sovereignty_coordination
         WHERE status IN ('expired', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
