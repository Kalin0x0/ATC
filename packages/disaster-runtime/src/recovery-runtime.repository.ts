import type { RowDataPacket } from 'mysql2/promise'
import type { DisasterRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { RecoveryRuntimeNotFoundError } from './errors.js'

export interface AtcRecoveryRuntime {
  id: string
  disasterId: string
  recoveryPhase: string
  progressPercent: number
  estimatedCompletionAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface RecoveryRuntimeRow extends RowDataPacket {
  id: string
  disaster_id: string
  recovery_phase: string
  progress_percent: number
  estimated_completion_at: Date | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToRecoveryRuntime(row: RecoveryRuntimeRow): AtcRecoveryRuntime {
  return {
    id: row.id,
    disasterId: row.disaster_id,
    recoveryPhase: row.recovery_phase,
    progressPercent: Number(row.progress_percent),
    estimatedCompletionAt: row.estimated_completion_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertRecoveryRuntimeParams {
  recoveryPhase: string
  progressPercent: number
  estimatedCompletionAt?: Date | undefined
}

export class RecoveryRuntimeRepository {
  constructor(private readonly pool: DisasterRuntimePool) {}

  async findByDisasterId(disasterId: string): Promise<AtcRecoveryRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RecoveryRuntimeRow[]>(
        `SELECT * FROM atc_recovery_runtime WHERE disaster_id = ? LIMIT 1`,
        [disasterId],
      )
      return rows[0] ? rowToRecoveryRuntime(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async upsert(disasterId: string, params: UpsertRecoveryRuntimeParams): Promise<AtcRecoveryRuntime> {
    const id = generateId()
    const estimatedCompletionAt = params.estimatedCompletionAt ?? null
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_recovery_runtime
           (id, disaster_id, recovery_phase, progress_percent, estimated_completion_at,
            completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           recovery_phase           = VALUES(recovery_phase),
           progress_percent         = VALUES(progress_percent),
           estimated_completion_at  = VALUES(estimated_completion_at),
           updated_at               = NOW(3)`,
        [
          id,
          disasterId,
          params.recoveryPhase,
          params.progressPercent,
          estimatedCompletionAt,
        ] as (string | number | boolean | null | Date)[],
      )
      const [rows] = await conn.execute<RecoveryRuntimeRow[]>(
        `SELECT * FROM atc_recovery_runtime WHERE disaster_id = ? LIMIT 1`,
        [disasterId],
      )
      if (!rows[0]) throw new RecoveryRuntimeNotFoundError(disasterId)
      return rowToRecoveryRuntime(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateProgress(disasterId: string, progressPercent: number): Promise<AtcRecoveryRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<RecoveryRuntimeRow[]>(
          `SELECT * FROM atc_recovery_runtime WHERE disaster_id = ? LIMIT 1 FOR UPDATE`,
          [disasterId],
        )
        if (!rows[0]) {
          await conn.rollback()
          throw new RecoveryRuntimeNotFoundError(disasterId)
        }
        await conn.execute(
          `UPDATE atc_recovery_runtime
           SET progress_percent = ?, updated_at = NOW(3)
           WHERE disaster_id = ?`,
          [progressPercent, disasterId] as (string | number | boolean | null)[],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [updated] = await conn.execute<RecoveryRuntimeRow[]>(
        `SELECT * FROM atc_recovery_runtime WHERE disaster_id = ? LIMIT 1`,
        [disasterId],
      )
      if (!updated[0]) throw new RecoveryRuntimeNotFoundError(disasterId)
      return rowToRecoveryRuntime(updated[0])
    } finally {
      conn.release()
    }
  }
}
