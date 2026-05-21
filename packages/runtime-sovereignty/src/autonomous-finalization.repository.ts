import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { SovereigntyRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateAutonomousFinalizationError, AutonomousFinalizationNotFoundError } from './errors.js'

export type AtcAutonomousFinalizationType = 'epoch' | 'session' | 'cluster' | 'runtime' | 'custom'
export type AtcAutonomousFinalizationStatus = 'pending' | 'processing' | 'finalized' | 'aborted' | 'failed'

export interface AtcAutonomousFinalization {
  id: string
  finalizationId: string
  finalizationType: AtcAutonomousFinalizationType
  status: AtcAutonomousFinalizationStatus
  ownerServerId: string
  finalizationNonce: string
  finalizationData: Record<string, unknown>
  finalizedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateAutonomousFinalizationParams {
  finalizationType: AtcAutonomousFinalizationType
  ownerServerId: string
  finalizationNonce: string
  finalizationData?: Record<string, unknown> | undefined
}

interface AutonomousFinalizationRow extends RowDataPacket {
  id: string
  finalization_id: string
  finalization_type: string
  status: string
  owner_server_id: string
  finalization_nonce: string
  finalization_data: string | null
  finalized_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: AutonomousFinalizationRow): AtcAutonomousFinalization {
  let finalizationData: Record<string, unknown> = {}
  if (row.finalization_data) {
    try {
      finalizationData = JSON.parse(row.finalization_data) as Record<string, unknown>
    } catch {
      finalizationData = {}
    }
  }
  return {
    id: row.id,
    finalizationId: row.finalization_id,
    finalizationType: row.finalization_type as AtcAutonomousFinalizationType,
    status: row.status as AtcAutonomousFinalizationStatus,
    ownerServerId: row.owner_server_id,
    finalizationNonce: row.finalization_nonce,
    finalizationData,
    finalizedAt: row.finalized_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class AutonomousFinalizationRepository {
  constructor(private readonly pool: SovereigntyRuntimePool) {}

  async create(params: CreateAutonomousFinalizationParams): Promise<AtcAutonomousFinalization> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const finalizationId = generateId()
      const finalizationDataJson = JSON.stringify(params.finalizationData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_autonomous_finalization
             (id, finalization_id, finalization_type, status, owner_server_id, finalization_nonce,
              finalization_data, finalized_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            finalizationId,
            params.finalizationType,
            params.ownerServerId,
            params.finalizationNonce,
            finalizationDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateAutonomousFinalizationError(params.finalizationNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<AutonomousFinalizationRow[]>(
        `SELECT id, finalization_id, finalization_type, status, owner_server_id, finalization_nonce,
                finalization_data, finalized_at, created_at, updated_at
         FROM atc_autonomous_finalization
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Autonomous finalization record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcAutonomousFinalization | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AutonomousFinalizationRow[]>(
        `SELECT id, finalization_id, finalization_type, status, owner_server_id, finalization_nonce,
                finalization_data, finalized_at, created_at, updated_at
         FROM atc_autonomous_finalization
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
    status: AtcAutonomousFinalizationStatus,
    finalizedAt?: Date | undefined
  ): Promise<AtcAutonomousFinalization> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<AutonomousFinalizationRow[]>(
          `SELECT id, finalization_id, finalization_type, status, owner_server_id, finalization_nonce,
                  finalization_data, finalized_at, created_at, updated_at
           FROM atc_autonomous_finalization
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new AutonomousFinalizationNotFoundError(id)

        if (finalizedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_autonomous_finalization
             SET status = ?, finalized_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              finalizedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_autonomous_finalization
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<AutonomousFinalizationRow[]>(
          `SELECT id, finalization_id, finalization_type, status, owner_server_id, finalization_nonce,
                  finalization_data, finalized_at, created_at, updated_at
           FROM atc_autonomous_finalization
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new AutonomousFinalizationNotFoundError(id)

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
        `DELETE FROM atc_autonomous_finalization
         WHERE status IN ('finalized', 'aborted', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
