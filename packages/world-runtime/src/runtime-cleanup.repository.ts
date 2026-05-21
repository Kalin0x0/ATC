import type { RowDataPacket } from 'mysql2/promise'
import type { AtcRuntimeCleanup, AtcCleanupReason } from '@atc/shared-types'
import type { WorldPool } from './pool.js'
import { generateId } from './id.js'
import { CleanupNotFoundError } from './errors.js'

interface CleanupRow extends RowDataPacket {
  id: string
  target_type: string
  target_id: string
  cleanup_reason: string
  scheduled_at: Date
  completed_at: Date | null
  node_id: string | null
}

function rowToCleanup(row: CleanupRow): AtcRuntimeCleanup {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    cleanupReason: row.cleanup_reason as AtcCleanupReason,
    scheduledAt: row.scheduled_at,
    completedAt: row.completed_at,
    nodeId: row.node_id,
  }
}

export interface ScheduleCleanupParams {
  targetType: string
  targetId: string
  cleanupReason: AtcCleanupReason
  nodeId?: string | undefined
}

export class RuntimeCleanupRepository {
  constructor(private readonly pool: WorldPool) {}

  async schedule(params: ScheduleCleanupParams): Promise<AtcRuntimeCleanup> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_runtime_cleanup
           (id, target_type, target_id, cleanup_reason, scheduled_at, node_id)
         VALUES (?, ?, ?, ?, NOW(3), ?)`,
        [
          id,
          params.targetType,
          params.targetId,
          params.cleanupReason,
          params.nodeId ?? null,
        ],
      )
      const [rows] = await conn.execute<CleanupRow[]>(
        `SELECT * FROM atc_runtime_cleanup WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new CleanupNotFoundError(id)
      return rowToCleanup(rows[0])
    } finally {
      conn.release()
    }
  }

  async complete(
    id: string,
    conn?: Awaited<ReturnType<WorldPool['getConnection']>>,
  ): Promise<AtcRuntimeCleanup> {
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      await connection.execute(
        `UPDATE atc_runtime_cleanup SET completed_at = NOW(3) WHERE id = ? AND completed_at IS NULL`,
        [id],
      )
      const [rows] = await connection.execute<CleanupRow[]>(
        `SELECT * FROM atc_runtime_cleanup WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new CleanupNotFoundError(id)
      return rowToCleanup(rows[0])
    } finally {
      if (owned) connection.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeCleanup | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CleanupRow[]>(
        `SELECT * FROM atc_runtime_cleanup WHERE id = ? LIMIT 1`,
        [id],
      )
      return rows[0] ? rowToCleanup(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listPending(nodeId?: string): Promise<AtcRuntimeCleanup[]> {
    const conn = await this.pool.getConnection()
    try {
      if (nodeId !== undefined) {
        const [rows] = await conn.execute<CleanupRow[]>(
          `SELECT * FROM atc_runtime_cleanup
           WHERE completed_at IS NULL AND node_id = ?
           ORDER BY scheduled_at ASC`,
          [nodeId],
        )
        return rows.map(rowToCleanup)
      }
      const [rows] = await conn.execute<CleanupRow[]>(
        `SELECT * FROM atc_runtime_cleanup
         WHERE completed_at IS NULL
         ORDER BY scheduled_at ASC`,
      )
      return rows.map(rowToCleanup)
    } finally {
      conn.release()
    }
  }

  async listByTarget(targetType: string, targetId: string): Promise<AtcRuntimeCleanup[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CleanupRow[]>(
        `SELECT * FROM atc_runtime_cleanup
         WHERE target_type = ? AND target_id = ?
         ORDER BY scheduled_at DESC`,
        [targetType, targetId],
      )
      return rows.map(rowToCleanup)
    } finally {
      conn.release()
    }
  }
}
