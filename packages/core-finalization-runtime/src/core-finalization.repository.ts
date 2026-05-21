import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { CoreFinalizationPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateFinalizationError, FinalizationNotFoundError } from './errors.js'

export type AtcCoreFinalizationType = 'runtime' | 'epoch' | 'session' | 'world' | 'custom'
export type AtcCoreFinalizationStatus = 'pending' | 'active' | 'completing' | 'completed' | 'failed'

export interface AtcCoreFinalization {
  id: string
  finalizationId: string
  finalizationType: AtcCoreFinalizationType
  status: AtcCoreFinalizationStatus
  ownerServerId: string
  finalizationNonce: string
  finalizationData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateCoreFinalizationParams {
  finalizationType: AtcCoreFinalizationType
  ownerServerId: string
  finalizationNonce: string
  finalizationData?: Record<string, unknown> | undefined
}

interface CoreFinalizationRow extends RowDataPacket {
  id: string
  finalization_id: string
  finalization_type: string
  status: string
  owner_server_id: string
  finalization_nonce: string
  finalization_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: CoreFinalizationRow): AtcCoreFinalization {
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
    finalizationType: row.finalization_type as AtcCoreFinalizationType,
    status: row.status as AtcCoreFinalizationStatus,
    ownerServerId: row.owner_server_id,
    finalizationNonce: row.finalization_nonce,
    finalizationData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class CoreFinalizationRepository {
  constructor(private readonly pool: CoreFinalizationPool) {}

  async create(params: CreateCoreFinalizationParams): Promise<AtcCoreFinalization> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const finalizationId = generateId()
      const finalizationDataJson = JSON.stringify(params.finalizationData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_core_finalization
             (id, finalization_id, finalization_type, status, owner_server_id, finalization_nonce,
              finalization_data, completed_at, created_at, updated_at)
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

      const [rows] = await conn.execute<CoreFinalizationRow[]>(
        `SELECT id, finalization_id, finalization_type, status, owner_server_id, finalization_nonce,
                finalization_data, completed_at, created_at, updated_at
         FROM atc_core_finalization
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Core finalization record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcCoreFinalization | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CoreFinalizationRow[]>(
        `SELECT id, finalization_id, finalization_type, status, owner_server_id, finalization_nonce,
                finalization_data, completed_at, created_at, updated_at
         FROM atc_core_finalization
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
    status: AtcCoreFinalizationStatus,
    completedAt?: Date | undefined
  ): Promise<AtcCoreFinalization> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<CoreFinalizationRow[]>(
          `SELECT id, finalization_id, finalization_type, status, owner_server_id, finalization_nonce,
                  finalization_data, completed_at, created_at, updated_at
           FROM atc_core_finalization
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new FinalizationNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_core_finalization
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
            `UPDATE atc_core_finalization
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<CoreFinalizationRow[]>(
          `SELECT id, finalization_id, finalization_type, status, owner_server_id, finalization_nonce,
                  finalization_data, completed_at, created_at, updated_at
           FROM atc_core_finalization
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
        `DELETE FROM atc_core_finalization
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
