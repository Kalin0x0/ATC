import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { CoreFinalizationPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateCompletionError, CompletionNotFoundError } from './errors.js'

export type AtcCompletionType = 'graceful' | 'forced' | 'scheduled' | 'emergency' | 'custom'
export type AtcCompletionStatus = 'pending' | 'progressing' | 'completed' | 'aborted' | 'failed'

export interface AtcRuntimeCompletion {
  id: string
  completionId: string
  completionType: AtcCompletionType
  status: AtcCompletionStatus
  ownerServerId: string
  completionNonce: string
  completionData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateCompletionParams {
  completionType: AtcCompletionType
  ownerServerId: string
  completionNonce: string
  completionData?: Record<string, unknown> | undefined
}

interface RuntimeCompletionRow extends RowDataPacket {
  id: string
  completion_id: string
  completion_type: string
  status: string
  owner_server_id: string
  completion_nonce: string
  completion_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeCompletionRow): AtcRuntimeCompletion {
  let completionData: Record<string, unknown> = {}
  if (row.completion_data) {
    try {
      completionData = JSON.parse(row.completion_data) as Record<string, unknown>
    } catch {
      completionData = {}
    }
  }
  return {
    id: row.id,
    completionId: row.completion_id,
    completionType: row.completion_type as AtcCompletionType,
    status: row.status as AtcCompletionStatus,
    ownerServerId: row.owner_server_id,
    completionNonce: row.completion_nonce,
    completionData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeCompletionRepository {
  constructor(private readonly pool: CoreFinalizationPool) {}

  async create(params: CreateCompletionParams): Promise<AtcRuntimeCompletion> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const completionId = generateId()
      const completionDataJson = JSON.stringify(params.completionData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_completion
             (id, completion_id, completion_type, status, owner_server_id, completion_nonce,
              completion_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            completionId,
            params.completionType,
            params.ownerServerId,
            params.completionNonce,
            completionDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateCompletionError(params.completionNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<RuntimeCompletionRow[]>(
        `SELECT id, completion_id, completion_type, status, owner_server_id, completion_nonce,
                completion_data, completed_at, created_at, updated_at
         FROM atc_runtime_completion
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Runtime completion record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeCompletion | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeCompletionRow[]>(
        `SELECT id, completion_id, completion_type, status, owner_server_id, completion_nonce,
                completion_data, completed_at, created_at, updated_at
         FROM atc_runtime_completion
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
    status: AtcCompletionStatus,
    completedAt?: Date | undefined
  ): Promise<AtcRuntimeCompletion> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeCompletionRow[]>(
          `SELECT id, completion_id, completion_type, status, owner_server_id, completion_nonce,
                  completion_data, completed_at, created_at, updated_at
           FROM atc_runtime_completion
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new CompletionNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_completion
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
            `UPDATE atc_runtime_completion
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<RuntimeCompletionRow[]>(
          `SELECT id, completion_id, completion_type, status, owner_server_id, completion_nonce,
                  completion_data, completed_at, created_at, updated_at
           FROM atc_runtime_completion
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new CompletionNotFoundError(id)

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
        `DELETE FROM atc_runtime_completion
         WHERE status IN ('completed', 'aborted', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
