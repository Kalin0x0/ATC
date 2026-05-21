import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReleaseGovernancePool } from './pool.js'
import { generateId } from './id.js'
import { GlobalReleaseRuntimeNotFoundError, DuplicateGlobalReleaseRuntimeError } from './errors.js'

export type AtcGlobalReleaseType = 'major' | 'minor' | 'patch' | 'hotfix' | 'custom'
export type AtcGlobalReleaseStatus = 'pending' | 'active' | 'completed' | 'reverted' | 'failed'

export interface AtcGlobalReleaseRuntime {
  id: string
  releaseId: string
  releaseType: AtcGlobalReleaseType
  status: AtcGlobalReleaseStatus
  ownerServerId: string
  releaseNonce: string
  releaseData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateGlobalReleaseParams {
  releaseType: AtcGlobalReleaseType
  ownerServerId: string
  releaseNonce: string
  releaseData?: Record<string, unknown> | undefined
}

interface GlobalReleaseRuntimeRow extends RowDataPacket {
  id: string
  release_id: string
  release_type: string
  status: string
  owner_server_id: string
  release_nonce: string
  release_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: GlobalReleaseRuntimeRow): AtcGlobalReleaseRuntime {
  let releaseData: Record<string, unknown> = {}
  if (row.release_data) {
    try {
      releaseData = JSON.parse(row.release_data) as Record<string, unknown>
    } catch {
      releaseData = {}
    }
  }
  return {
    id: row.id,
    releaseId: row.release_id,
    releaseType: row.release_type as AtcGlobalReleaseType,
    status: row.status as AtcGlobalReleaseStatus,
    ownerServerId: row.owner_server_id,
    releaseNonce: row.release_nonce,
    releaseData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class GlobalReleaseRuntimeRepository {
  constructor(private readonly pool: ReleaseGovernancePool) {}

  async create(params: CreateGlobalReleaseParams): Promise<AtcGlobalReleaseRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const releaseId = generateId()
      const releaseDataJson = JSON.stringify(params.releaseData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_global_release_runtime
             (id, release_id, release_type, status, owner_server_id,
              release_nonce, release_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            releaseId,
            params.releaseType,
            params.ownerServerId,
            params.releaseNonce,
            releaseDataJson,
          ] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateGlobalReleaseRuntimeError(params.releaseNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<GlobalReleaseRuntimeRow[]>(
        `SELECT id, release_id, release_type, status, owner_server_id,
                release_nonce, release_data, completed_at, created_at, updated_at
         FROM atc_global_release_runtime
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) throw new Error(`Global release runtime not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcGlobalReleaseRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GlobalReleaseRuntimeRow[]>(
        `SELECT id, release_id, release_type, status, owner_server_id,
                release_nonce, release_data, completed_at, created_at, updated_at
         FROM atc_global_release_runtime
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcGlobalReleaseStatus,
    completedAt?: Date | undefined
  ): Promise<AtcGlobalReleaseRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<GlobalReleaseRuntimeRow[]>(
          `SELECT id, release_id, release_type, status, owner_server_id,
                  release_nonce, release_data, completed_at, created_at, updated_at
           FROM atc_global_release_runtime
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as unknown[]
        )
        if (!lockRows[0]) throw new GlobalReleaseRuntimeNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_global_release_runtime
             SET status = ?, completed_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_global_release_runtime
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as unknown[]
          )
        }

        const [rows] = await conn.execute<GlobalReleaseRuntimeRow[]>(
          `SELECT id, release_id, release_type, status, owner_server_id,
                  release_nonce, release_data, completed_at, created_at, updated_at
           FROM atc_global_release_runtime
           WHERE id = ?
           LIMIT 1`,
          [id] as unknown[]
        )
        if (!rows[0]) throw new GlobalReleaseRuntimeNotFoundError(id)

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
        `DELETE FROM atc_global_release_runtime
         WHERE status IN ('reverted', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
