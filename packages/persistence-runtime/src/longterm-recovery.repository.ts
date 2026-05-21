import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { PersistenceRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { RecoveryNotFoundError, DuplicateRecoveryError } from './errors.js'

export type AtcLongTermRecoveryType = 'point_in_time' | 'snapshot' | 'archive' | 'full_restore' | 'partial' | 'custom'
export type AtcLongTermRecoveryStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

export interface AtcLongtermRecovery {
  id: string
  recoveryId: string
  recoveryType: AtcLongTermRecoveryType
  entityId: string | null
  status: AtcLongTermRecoveryStatus
  ownerServerId: string
  recoveryNonce: string
  recoveryData: Record<string, unknown>
  startedAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateLongtermRecoveryParams {
  recoveryType: AtcLongTermRecoveryType
  ownerServerId: string
  recoveryNonce: string
  entityId?: string | undefined
  recoveryData?: Record<string, unknown> | undefined
}

interface RecoveryRow extends RowDataPacket {
  id: string
  recovery_id: string
  recovery_type: string
  entity_id: string | null
  status: string
  owner_server_id: string
  recovery_nonce: string
  recovery_data: string | null
  started_at: Date
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RecoveryRow): AtcLongtermRecovery {
  let recoveryData: Record<string, unknown> = {}
  if (row.recovery_data) {
    try { recoveryData = JSON.parse(row.recovery_data) as Record<string, unknown> } catch { recoveryData = {} }
  }
  return {
    id: row.id,
    recoveryId: row.recovery_id,
    recoveryType: row.recovery_type as AtcLongTermRecoveryType,
    entityId: row.entity_id,
    status: row.status as AtcLongTermRecoveryStatus,
    ownerServerId: row.owner_server_id,
    recoveryNonce: row.recovery_nonce,
    recoveryData,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class LongtermRecoveryRepository {
  constructor(private readonly pool: PersistenceRuntimePool) {}

  async create(params: CreateLongtermRecoveryParams): Promise<AtcLongtermRecovery> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const recoveryId = generateId()
      const recoveryDataJson = JSON.stringify(params.recoveryData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_longterm_recovery
             (id, recovery_id, recovery_type, entity_id, status, owner_server_id,
              recovery_nonce, recovery_data, started_at, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, NOW(3), NULL, NOW(3), NOW(3))`,
          [id, recoveryId, params.recoveryType, params.entityId ?? null,
           params.ownerServerId, params.recoveryNonce, recoveryDataJson] as (string | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateRecoveryError(params.recoveryNonce)
        throw err
      }

      const [rows] = await conn.execute<RecoveryRow[]>(
        `SELECT id, recovery_id, recovery_type, entity_id, status, owner_server_id,
                recovery_nonce, recovery_data, started_at, completed_at, created_at, updated_at
         FROM atc_longterm_recovery WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Recovery not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcLongtermRecovery | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RecoveryRow[]>(
        `SELECT id, recovery_id, recovery_type, entity_id, status, owner_server_id,
                recovery_nonce, recovery_data, started_at, completed_at, created_at, updated_at
         FROM atc_longterm_recovery WHERE id = ? LIMIT 1`,
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
    status: AtcLongTermRecoveryStatus,
    completedAt?: Date | undefined
  ): Promise<AtcLongtermRecovery> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RecoveryRow[]>(
          `SELECT id FROM atc_longterm_recovery WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new RecoveryNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_longterm_recovery SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as string[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_longterm_recovery SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id]
          )
        }

        const [rows] = await conn.execute<RecoveryRow[]>(
          `SELECT id, recovery_id, recovery_type, entity_id, status, owner_server_id,
                  recovery_nonce, recovery_data, started_at, completed_at, created_at, updated_at
           FROM atc_longterm_recovery WHERE id = ? LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new RecoveryNotFoundError(id)
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
        `DELETE FROM atc_longterm_recovery
         WHERE status IN ('completed', 'failed', 'cancelled')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
