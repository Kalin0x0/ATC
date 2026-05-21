import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ContinuityRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateCheckpointError, CheckpointNotFoundError } from './errors.js'

export type AtcCheckpointType = 'entity' | 'world' | 'system' | 'transaction' | 'custom'
export type AtcCheckpointStatus = 'pending' | 'committed' | 'rolled_back' | 'expired'

export interface AtcCheckpointRuntime {
  id: string
  checkpointId: string
  checkpointType: AtcCheckpointType
  status: AtcCheckpointStatus
  ownerServerId: string
  checkpointNonce: string
  checkpointData: Record<string, unknown>
  committedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateCheckpointParams {
  checkpointType: AtcCheckpointType
  ownerServerId: string
  checkpointNonce: string
  checkpointData?: Record<string, unknown> | undefined
}

interface CheckpointRuntimeRow extends RowDataPacket {
  id: string
  checkpoint_id: string
  checkpoint_type: string
  status: string
  owner_server_id: string
  checkpoint_nonce: string
  checkpoint_data: string | null
  committed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: CheckpointRuntimeRow): AtcCheckpointRuntime {
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
    checkpointId: row.checkpoint_id,
    checkpointType: row.checkpoint_type as AtcCheckpointType,
    status: row.status as AtcCheckpointStatus,
    ownerServerId: row.owner_server_id,
    checkpointNonce: row.checkpoint_nonce,
    checkpointData,
    committedAt: row.committed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class CheckpointRuntimeRepository {
  constructor(private readonly pool: ContinuityRuntimePool) {}

  async create(params: CreateCheckpointParams): Promise<AtcCheckpointRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const checkpointId = generateId()
      const checkpointDataJson = JSON.stringify(params.checkpointData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_checkpoint_runtime
             (id, checkpoint_id, checkpoint_type, status, owner_server_id, checkpoint_nonce,
              checkpoint_data, committed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            checkpointId,
            params.checkpointType,
            params.ownerServerId,
            params.checkpointNonce,
            checkpointDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateCheckpointError(params.checkpointNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<CheckpointRuntimeRow[]>(
        `SELECT id, checkpoint_id, checkpoint_type, status, owner_server_id, checkpoint_nonce,
                checkpoint_data, committed_at, created_at, updated_at
         FROM atc_checkpoint_runtime
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Checkpoint runtime record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcCheckpointRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CheckpointRuntimeRow[]>(
        `SELECT id, checkpoint_id, checkpoint_type, status, owner_server_id, checkpoint_nonce,
                checkpoint_data, committed_at, created_at, updated_at
         FROM atc_checkpoint_runtime
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
    status: AtcCheckpointStatus,
    committedAt?: Date | undefined
  ): Promise<AtcCheckpointRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<CheckpointRuntimeRow[]>(
          `SELECT id, checkpoint_id, checkpoint_type, status, owner_server_id, checkpoint_nonce,
                  checkpoint_data, committed_at, created_at, updated_at
           FROM atc_checkpoint_runtime
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new CheckpointNotFoundError(id)

        if (committedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_checkpoint_runtime
             SET status = ?, committed_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              committedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_checkpoint_runtime
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<CheckpointRuntimeRow[]>(
          `SELECT id, checkpoint_id, checkpoint_type, status, owner_server_id, checkpoint_nonce,
                  checkpoint_data, committed_at, created_at, updated_at
           FROM atc_checkpoint_runtime
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new CheckpointNotFoundError(id)

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
        `DELETE FROM atc_checkpoint_runtime
         WHERE status IN ('committed', 'rolled_back', 'expired')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
