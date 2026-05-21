import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeResiliencePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateFailoverError, FailoverNotFoundError } from './errors.js'

export type AtcFailoverType = 'planned' | 'emergency' | 'cascade' | 'rolling' | 'custom'
export type AtcFailoverStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back'

export interface AtcRuntimeFailover {
  id: string
  failoverId: string
  failoverType: AtcFailoverType
  status: AtcFailoverStatus
  sourceServerId: string
  targetServerId: string
  failoverNonce: string
  failoverData: Record<string, unknown>
  startedAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateFailoverParams {
  failoverType: AtcFailoverType
  sourceServerId: string
  targetServerId: string
  failoverNonce: string
  failoverData?: Record<string, unknown> | undefined
}

interface RuntimeFailoverRow extends RowDataPacket {
  id: string
  failover_id: string
  failover_type: string
  status: string
  source_server_id: string
  target_server_id: string
  failover_nonce: string
  failover_data: string | null
  started_at: Date
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeFailoverRow): AtcRuntimeFailover {
  let failoverData: Record<string, unknown> = {}
  if (row.failover_data) {
    try {
      failoverData = JSON.parse(row.failover_data) as Record<string, unknown>
    } catch {
      failoverData = {}
    }
  }
  return {
    id: row.id,
    failoverId: row.failover_id,
    failoverType: row.failover_type as AtcFailoverType,
    status: row.status as AtcFailoverStatus,
    sourceServerId: row.source_server_id,
    targetServerId: row.target_server_id,
    failoverNonce: row.failover_nonce,
    failoverData,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeFailoverRepository {
  constructor(private readonly pool: RuntimeResiliencePool) {}

  async create(params: CreateFailoverParams): Promise<AtcRuntimeFailover> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const failoverId = generateId()
      const failoverDataJson = JSON.stringify(params.failoverData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_failover
             (id, failover_id, failover_type, status, source_server_id, target_server_id,
              failover_nonce, failover_data, started_at, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, NOW(3), NULL, NOW(3), NOW(3))`,
          [
            id,
            failoverId,
            params.failoverType,
            params.sourceServerId,
            params.targetServerId,
            params.failoverNonce,
            failoverDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateFailoverError(params.failoverNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<RuntimeFailoverRow[]>(
        `SELECT id, failover_id, failover_type, status, source_server_id, target_server_id,
                failover_nonce, failover_data, started_at, completed_at, created_at, updated_at
         FROM atc_runtime_failover
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Runtime failover not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeFailover | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeFailoverRow[]>(
        `SELECT id, failover_id, failover_type, status, source_server_id, target_server_id,
                failover_nonce, failover_data, started_at, completed_at, created_at, updated_at
         FROM atc_runtime_failover
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

  async findByFailoverId(failoverId: string): Promise<AtcRuntimeFailover | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeFailoverRow[]>(
        `SELECT id, failover_id, failover_type, status, source_server_id, target_server_id,
                failover_nonce, failover_data, started_at, completed_at, created_at, updated_at
         FROM atc_runtime_failover
         WHERE failover_id = ?
         LIMIT 1`,
        [failoverId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcFailoverStatus,
    completedAt?: Date | undefined
  ): Promise<AtcRuntimeFailover> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeFailoverRow[]>(
          `SELECT id, failover_id, failover_type, status, source_server_id, target_server_id,
                  failover_nonce, failover_data, started_at, completed_at, created_at, updated_at
           FROM atc_runtime_failover
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new FailoverNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_failover
             SET status = ?, completed_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_failover
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<RuntimeFailoverRow[]>(
          `SELECT id, failover_id, failover_type, status, source_server_id, target_server_id,
                  failover_nonce, failover_data, started_at, completed_at, created_at, updated_at
           FROM atc_runtime_failover
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new FailoverNotFoundError(id)

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

  async listActive(sourceServerId?: string | undefined): Promise<AtcRuntimeFailover[]> {
    const conn = await this.pool.getConnection()
    try {
      if (sourceServerId !== undefined) {
        const [rows] = await conn.execute<RuntimeFailoverRow[]>(
          `SELECT id, failover_id, failover_type, status, source_server_id, target_server_id,
                  failover_nonce, failover_data, started_at, completed_at, created_at, updated_at
           FROM atc_runtime_failover
           WHERE status IN ('pending', 'in_progress')
             AND source_server_id = ?
           ORDER BY created_at ASC`,
          [sourceServerId]
        )
        return rows.map(mapRow)
      }
      const [rows] = await conn.execute<RuntimeFailoverRow[]>(
        `SELECT id, failover_id, failover_type, status, source_server_id, target_server_id,
                failover_nonce, failover_data, started_at, completed_at, created_at, updated_at
         FROM atc_runtime_failover
         WHERE status IN ('pending', 'in_progress')
         ORDER BY created_at ASC`
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_runtime_failover
         WHERE status IN ('completed', 'failed', 'rolled_back')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
