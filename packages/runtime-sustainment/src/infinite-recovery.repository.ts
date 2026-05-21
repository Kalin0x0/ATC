import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeSustainmentPool } from './pool.js'
import { generateId } from './id.js'
import { RecoveryNotFoundError } from './errors.js'

export type AtcRecoveryType = 'full' | 'partial' | 'incremental' | 'snapshot' | 'custom'
export type AtcRecoveryStatus = 'active' | 'recovering' | 'completed' | 'failed'

export interface AtcInfiniteRecovery {
  id: string
  recoveryId: string
  recoveryType: AtcRecoveryType
  status: AtcRecoveryStatus
  ownerServerId: string
  recoveryData: Record<string, unknown>
  syncedAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface InitiateRecoveryParams {
  recoveryId: string
  recoveryType: AtcRecoveryType
  ownerServerId: string
  recoveryData?: Record<string, unknown> | undefined
}

interface InfiniteRecoveryRow extends RowDataPacket {
  id: string
  recovery_id: string
  recovery_type: string
  status: string
  owner_server_id: string
  recovery_data: string | null
  synced_at: Date
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: InfiniteRecoveryRow): AtcInfiniteRecovery {
  let recoveryData: Record<string, unknown> = {}
  if (row.recovery_data) {
    try {
      recoveryData = JSON.parse(row.recovery_data) as Record<string, unknown>
    } catch {
      recoveryData = {}
    }
  }
  return {
    id: row.id,
    recoveryId: row.recovery_id,
    recoveryType: row.recovery_type as AtcRecoveryType,
    status: row.status as AtcRecoveryStatus,
    ownerServerId: row.owner_server_id,
    recoveryData,
    syncedAt: row.synced_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class InfiniteRecoveryRepository {
  constructor(private readonly pool: RuntimeSustainmentPool) {}

  async upsert(params: InitiateRecoveryParams): Promise<AtcInfiniteRecovery> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const recoveryDataJson = JSON.stringify(params.recoveryData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_infinite_recovery
           (id, recovery_id, recovery_type, status, owner_server_id,
            recovery_data, synced_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, NOW(3), NULL, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           recovery_type = VALUES(recovery_type),
           status = VALUES(status),
           owner_server_id = VALUES(owner_server_id),
           recovery_data = VALUES(recovery_data),
           synced_at = NOW(3),
           updated_at = NOW(3)`,
        [
          id,
          params.recoveryId,
          params.recoveryType,
          params.ownerServerId,
          recoveryDataJson,
        ] as unknown[]
      )

      const [rows] = await conn.execute<InfiniteRecoveryRow[]>(
        `SELECT id, recovery_id, recovery_type, status, owner_server_id,
                recovery_data, synced_at, completed_at, created_at, updated_at
         FROM atc_infinite_recovery
         WHERE recovery_id = ?
         LIMIT 1`,
        [params.recoveryId] as unknown[]
      )
      if (!rows[0]) throw new Error(`Infinite recovery not found after upsert: ${params.recoveryId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByRecoveryId(recoveryId: string): Promise<AtcInfiniteRecovery | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InfiniteRecoveryRow[]>(
        `SELECT id, recovery_id, recovery_type, status, owner_server_id,
                recovery_data, synced_at, completed_at, created_at, updated_at
         FROM atc_infinite_recovery
         WHERE recovery_id = ?
         LIMIT 1`,
        [recoveryId] as unknown[]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    recoveryId: string,
    status: AtcRecoveryStatus,
    completedAt?: Date | undefined
  ): Promise<AtcInfiniteRecovery> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<InfiniteRecoveryRow[]>(
          `SELECT id, recovery_id, recovery_type, status, owner_server_id,
                  recovery_data, synced_at, completed_at, created_at, updated_at
           FROM atc_infinite_recovery
           WHERE recovery_id = ?
           LIMIT 1
           FOR UPDATE`,
          [recoveryId] as unknown[]
        )
        if (!lockRows[0]) throw new RecoveryNotFoundError(recoveryId)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_infinite_recovery
             SET status = ?, completed_at = ?, updated_at = NOW(3)
             WHERE recovery_id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), recoveryId] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_infinite_recovery
             SET status = ?, updated_at = NOW(3)
             WHERE recovery_id = ?`,
            [status, recoveryId] as unknown[]
          )
        }

        const [rows] = await conn.execute<InfiniteRecoveryRow[]>(
          `SELECT id, recovery_id, recovery_type, status, owner_server_id,
                  recovery_data, synced_at, completed_at, created_at, updated_at
           FROM atc_infinite_recovery
           WHERE recovery_id = ?
           LIMIT 1`,
          [recoveryId] as unknown[]
        )
        if (!rows[0]) throw new RecoveryNotFoundError(recoveryId)

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
        `DELETE FROM atc_infinite_recovery
         WHERE status IN ('completed', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
