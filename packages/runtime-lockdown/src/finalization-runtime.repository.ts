import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeLockdownPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateFinalizationError, FinalizationNotFoundError } from './errors.js'

export type AtcFinalizationType = 'transaction' | 'epoch' | 'session' | 'world_state' | 'custom'
export type AtcFinalizationStatus = 'pending' | 'committing' | 'committed' | 'rolling_back' | 'rolled_back'

export interface AtcFinalizationRuntime {
  id: string
  finalizationId: string
  finalizationType: AtcFinalizationType
  status: AtcFinalizationStatus
  ownerServerId: string
  finalizationNonce: string
  finalizationData: Record<string, unknown>
  finalizedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateFinalizationParams {
  finalizationType: AtcFinalizationType
  ownerServerId: string
  finalizationNonce: string
  finalizationData?: Record<string, unknown> | undefined
}

interface FinalizationRuntimeRow extends RowDataPacket {
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

function mapRow(row: FinalizationRuntimeRow): AtcFinalizationRuntime {
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
    finalizationType: row.finalization_type as AtcFinalizationType,
    status: row.status as AtcFinalizationStatus,
    ownerServerId: row.owner_server_id,
    finalizationNonce: row.finalization_nonce,
    finalizationData,
    finalizedAt: row.finalized_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class FinalizationRuntimeRepository {
  constructor(private readonly pool: RuntimeLockdownPool) {}

  async create(params: CreateFinalizationParams): Promise<AtcFinalizationRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const finalizationId = generateId()
      const finalizationDataJson = JSON.stringify(params.finalizationData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_finalization_runtime
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
          throw new DuplicateFinalizationError(params.finalizationNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<FinalizationRuntimeRow[]>(
        `SELECT id, finalization_id, finalization_type, status, owner_server_id, finalization_nonce,
                finalization_data, finalized_at, created_at, updated_at
         FROM atc_finalization_runtime
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      const row = rows[0]
      if (!row) throw new Error(`Finalization runtime record not found after insert: ${id}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcFinalizationRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FinalizationRuntimeRow[]>(
        `SELECT id, finalization_id, finalization_type, status, owner_server_id, finalization_nonce,
                finalization_data, finalized_at, created_at, updated_at
         FROM atc_finalization_runtime
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcFinalizationStatus,
    finalizedAt?: Date | undefined
  ): Promise<AtcFinalizationRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<FinalizationRuntimeRow[]>(
          `SELECT id, finalization_id, finalization_type, status, owner_server_id, finalization_nonce,
                  finalization_data, finalized_at, created_at, updated_at
           FROM atc_finalization_runtime
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        const lockRow = lockRows[0]
        if (!lockRow) throw new FinalizationNotFoundError(id)

        if (finalizedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_finalization_runtime
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
            `UPDATE atc_finalization_runtime
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<FinalizationRuntimeRow[]>(
          `SELECT id, finalization_id, finalization_type, status, owner_server_id, finalization_nonce,
                  finalization_data, finalized_at, created_at, updated_at
           FROM atc_finalization_runtime
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        const row = rows[0]
        if (!row) throw new FinalizationNotFoundError(id)

        await conn.commit()
        return mapRow(row)
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
        `DELETE FROM atc_finalization_runtime
         WHERE status IN ('committed', 'rolled_back')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
