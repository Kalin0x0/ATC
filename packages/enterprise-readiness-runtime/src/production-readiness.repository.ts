import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EnterpriseReadinessPool } from './pool.js'
import { generateId } from './id.js'
import { ProductionReadinessNotFoundError } from './errors.js'

export type AtcReadinessCheckpointType = 'pre_launch' | 'canary' | 'staged' | 'final' | 'custom'
export type AtcReadinessCheckpointStatus = 'active' | 'confirming' | 'confirmed' | 'blocked' | 'failed'

export interface AtcProductionReadiness {
  id: string
  readinessCheckpointId: string
  checkpointType: AtcReadinessCheckpointType
  status: AtcReadinessCheckpointStatus
  ownerServerId: string
  checkpointData: Record<string, unknown>
  syncedAt: Date
  confirmedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface InitiateReadinessParams {
  readinessCheckpointId: string
  checkpointType: AtcReadinessCheckpointType
  ownerServerId: string
  checkpointData?: Record<string, unknown> | undefined
}

interface ProductionReadinessRow extends RowDataPacket {
  id: string
  readiness_checkpoint_id: string
  checkpoint_type: string
  status: string
  owner_server_id: string
  checkpoint_data: string | null
  synced_at: Date
  confirmed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: ProductionReadinessRow): AtcProductionReadiness {
  let checkpointData: Record<string, unknown> = {}
  if (row.checkpoint_data) {
    try {
      checkpointData = JSON.parse(row.checkpoint_data) as Record<string, unknown>
    } catch {
      checkpointData = {}
    }
  }
  return {
    id: row.id,
    readinessCheckpointId: row.readiness_checkpoint_id,
    checkpointType: row.checkpoint_type as AtcReadinessCheckpointType,
    status: row.status as AtcReadinessCheckpointStatus,
    ownerServerId: row.owner_server_id,
    checkpointData,
    syncedAt: row.synced_at,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ProductionReadinessRepository {
  constructor(private readonly pool: EnterpriseReadinessPool) {}

  async upsert(params: InitiateReadinessParams): Promise<AtcProductionReadiness> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const checkpointDataJson = JSON.stringify(params.checkpointData ?? {})

      await conn.beginTransaction()
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_production_readiness
             (id, readiness_checkpoint_id, checkpoint_type, status, owner_server_id,
              checkpoint_data, synced_at, confirmed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?, NOW(3), NULL, NOW(3), NOW(3))
           ON DUPLICATE KEY UPDATE
             checkpoint_type = VALUES(checkpoint_type),
             status = VALUES(status),
             owner_server_id = VALUES(owner_server_id),
             checkpoint_data = VALUES(checkpoint_data),
             synced_at = NOW(3),
             updated_at = NOW(3)`,
          [
            id,
            params.readinessCheckpointId,
            params.checkpointType,
            params.ownerServerId,
            checkpointDataJson,
          ] as unknown[]
        )

        const [rows] = await conn.execute<ProductionReadinessRow[]>(
          `SELECT id, readiness_checkpoint_id, checkpoint_type, status, owner_server_id,
                  checkpoint_data, synced_at, confirmed_at, created_at, updated_at
           FROM atc_production_readiness
           WHERE readiness_checkpoint_id = ?
           LIMIT 1`,
          [params.readinessCheckpointId] as unknown[]
        )
        if (!rows[0]) throw new Error(`Production readiness not found after upsert: ${params.readinessCheckpointId}`)

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

  async findByCheckpointId(readinessCheckpointId: string): Promise<AtcProductionReadiness | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ProductionReadinessRow[]>(
        `SELECT id, readiness_checkpoint_id, checkpoint_type, status, owner_server_id,
                checkpoint_data, synced_at, confirmed_at, created_at, updated_at
         FROM atc_production_readiness
         WHERE readiness_checkpoint_id = ?
         LIMIT 1`,
        [readinessCheckpointId] as unknown[]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    readinessCheckpointId: string,
    status: AtcReadinessCheckpointStatus,
    confirmedAt?: Date | undefined
  ): Promise<AtcProductionReadiness> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ProductionReadinessRow[]>(
          `SELECT id, readiness_checkpoint_id, checkpoint_type, status, owner_server_id,
                  checkpoint_data, synced_at, confirmed_at, created_at, updated_at
           FROM atc_production_readiness
           WHERE readiness_checkpoint_id = ?
           LIMIT 1
           FOR UPDATE`,
          [readinessCheckpointId] as unknown[]
        )
        if (!lockRows[0]) throw new ProductionReadinessNotFoundError(readinessCheckpointId)

        if (confirmedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_production_readiness
             SET status = ?, confirmed_at = ?, updated_at = NOW(3)
             WHERE readiness_checkpoint_id = ?`,
            [status, confirmedAt.toISOString().replace('T', ' ').replace('Z', ''), readinessCheckpointId] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_production_readiness
             SET status = ?, updated_at = NOW(3)
             WHERE readiness_checkpoint_id = ?`,
            [status, readinessCheckpointId] as unknown[]
          )
        }

        const [rows] = await conn.execute<ProductionReadinessRow[]>(
          `SELECT id, readiness_checkpoint_id, checkpoint_type, status, owner_server_id,
                  checkpoint_data, synced_at, confirmed_at, created_at, updated_at
           FROM atc_production_readiness
           WHERE readiness_checkpoint_id = ?
           LIMIT 1`,
          [readinessCheckpointId] as unknown[]
        )
        if (!rows[0]) throw new ProductionReadinessNotFoundError(readinessCheckpointId)

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
        `DELETE FROM atc_production_readiness
         WHERE status IN ('blocked', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
