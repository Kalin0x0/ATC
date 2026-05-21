import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ContinuityRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { TemporalRecoveryNotFoundError } from './errors.js'

export type AtcTemporalRecoveryType = 'point_in_time' | 'epoch_rollback' | 'delta_replay' | 'full_restore' | 'custom'
export type AtcTemporalRecoveryStatus = 'pending' | 'recovering' | 'completed' | 'failed'

export interface AtcTemporalRecovery {
  id: string
  recoveryId: string
  recoveryType: AtcTemporalRecoveryType
  status: AtcTemporalRecoveryStatus
  ownerServerId: string
  recoveryNonce: string
  targetTimestamp: Date | null
  recoveryData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateTemporalRecoveryParams {
  recoveryType: AtcTemporalRecoveryType
  ownerServerId: string
  recoveryNonce: string
  targetTimestamp?: Date | undefined
  recoveryData?: Record<string, unknown> | undefined
}

interface TemporalRecoveryRow extends RowDataPacket {
  id: string
  recovery_id: string
  recovery_type: string
  status: string
  owner_server_id: string
  recovery_nonce: string
  target_timestamp: Date | null
  recovery_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: TemporalRecoveryRow): AtcTemporalRecovery {
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
    recoveryType: row.recovery_type as AtcTemporalRecoveryType,
    status: row.status as AtcTemporalRecoveryStatus,
    ownerServerId: row.owner_server_id,
    recoveryNonce: row.recovery_nonce,
    targetTimestamp: row.target_timestamp,
    recoveryData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class TemporalRecoveryRepository {
  constructor(private readonly pool: ContinuityRuntimePool) {}

  async create(params: CreateTemporalRecoveryParams): Promise<AtcTemporalRecovery> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const recoveryId = generateId()
      const recoveryDataJson = JSON.stringify(params.recoveryData ?? {})
      const targetTimestamp = params.targetTimestamp != null
        ? params.targetTimestamp.toISOString().replace('T', ' ').replace('Z', '')
        : null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_temporal_recovery
           (id, recovery_id, recovery_type, status, owner_server_id, recovery_nonce,
            target_timestamp, recovery_data, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, NULL, NOW(3), NOW(3))`,
        [
          id,
          recoveryId,
          params.recoveryType,
          params.ownerServerId,
          params.recoveryNonce,
          targetTimestamp,
          recoveryDataJson,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<TemporalRecoveryRow[]>(
        `SELECT id, recovery_id, recovery_type, status, owner_server_id, recovery_nonce,
                target_timestamp, recovery_data, completed_at, created_at, updated_at
         FROM atc_temporal_recovery
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Temporal recovery record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcTemporalRecovery | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TemporalRecoveryRow[]>(
        `SELECT id, recovery_id, recovery_type, status, owner_server_id, recovery_nonce,
                target_timestamp, recovery_data, completed_at, created_at, updated_at
         FROM atc_temporal_recovery
         WHERE id = ?
         LIMIT 1`,
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
    status: AtcTemporalRecoveryStatus,
    completedAt?: Date | undefined
  ): Promise<AtcTemporalRecovery> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<TemporalRecoveryRow[]>(
          `SELECT id, recovery_id, recovery_type, status, owner_server_id, recovery_nonce,
                  target_timestamp, recovery_data, completed_at, created_at, updated_at
           FROM atc_temporal_recovery
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new TemporalRecoveryNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_temporal_recovery
             SET status = ?, completed_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              completedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_temporal_recovery
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<TemporalRecoveryRow[]>(
          `SELECT id, recovery_id, recovery_type, status, owner_server_id, recovery_nonce,
                  target_timestamp, recovery_data, completed_at, created_at, updated_at
           FROM atc_temporal_recovery
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new TemporalRecoveryNotFoundError(id)

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
        `DELETE FROM atc_temporal_recovery
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
