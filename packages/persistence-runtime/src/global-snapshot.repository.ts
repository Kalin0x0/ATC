import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { PersistenceRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateSnapshotError, SnapshotNotFoundError } from './errors.js'

export type AtcSnapshotType = 'full' | 'incremental' | 'differential' | 'checkpoint' | 'emergency' | 'custom'
export type AtcSnapshotStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired'

export interface AtcGlobalSnapshot {
  id: string
  snapshotId: string
  snapshotType: AtcSnapshotType
  entityId: string | null
  status: AtcSnapshotStatus
  ownerServerId: string
  snapshotNonce: string
  snapshotData: Record<string, unknown>
  takenAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateSnapshotParams {
  snapshotType: AtcSnapshotType
  ownerServerId: string
  snapshotNonce: string
  entityId?: string | undefined
  snapshotData?: Record<string, unknown> | undefined
}

interface SnapshotRow extends RowDataPacket {
  id: string
  snapshot_id: string
  snapshot_type: string
  entity_id: string | null
  status: string
  owner_server_id: string
  snapshot_nonce: string
  snapshot_data: string | null
  taken_at: Date
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: SnapshotRow): AtcGlobalSnapshot {
  let snapshotData: Record<string, unknown> = {}
  if (row.snapshot_data) {
    try { snapshotData = JSON.parse(row.snapshot_data) as Record<string, unknown> } catch { snapshotData = {} }
  }
  return {
    id: row.id,
    snapshotId: row.snapshot_id,
    snapshotType: row.snapshot_type as AtcSnapshotType,
    entityId: row.entity_id,
    status: row.status as AtcSnapshotStatus,
    ownerServerId: row.owner_server_id,
    snapshotNonce: row.snapshot_nonce,
    snapshotData,
    takenAt: row.taken_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class GlobalSnapshotRepository {
  constructor(private readonly pool: PersistenceRuntimePool) {}

  async create(params: CreateSnapshotParams): Promise<AtcGlobalSnapshot> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const snapshotId = generateId()
      const snapshotDataJson = JSON.stringify(params.snapshotData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_global_snapshots
             (id, snapshot_id, snapshot_type, entity_id, status, owner_server_id,
              snapshot_nonce, snapshot_data, taken_at, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, NOW(3), NULL, NOW(3), NOW(3))`,
          [id, snapshotId, params.snapshotType, params.entityId ?? null,
           params.ownerServerId, params.snapshotNonce, snapshotDataJson] as (string | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateSnapshotError(params.snapshotNonce)
        throw err
      }

      const [rows] = await conn.execute<SnapshotRow[]>(
        `SELECT id, snapshot_id, snapshot_type, entity_id, status, owner_server_id,
                snapshot_nonce, snapshot_data, taken_at, completed_at, created_at, updated_at
         FROM atc_global_snapshots WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Snapshot not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcGlobalSnapshot | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SnapshotRow[]>(
        `SELECT id, snapshot_id, snapshot_type, entity_id, status, owner_server_id,
                snapshot_nonce, snapshot_data, taken_at, completed_at, created_at, updated_at
         FROM atc_global_snapshots WHERE id = ? LIMIT 1`,
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
    status: AtcSnapshotStatus,
    completedAt?: Date | undefined
  ): Promise<AtcGlobalSnapshot> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<SnapshotRow[]>(
          `SELECT id, snapshot_id, snapshot_type, entity_id, status, owner_server_id,
                  snapshot_nonce, snapshot_data, taken_at, completed_at, created_at, updated_at
           FROM atc_global_snapshots WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new SnapshotNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_global_snapshots SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as string[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_global_snapshots SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id]
          )
        }

        const [rows] = await conn.execute<SnapshotRow[]>(
          `SELECT id, snapshot_id, snapshot_type, entity_id, status, owner_server_id,
                  snapshot_nonce, snapshot_data, taken_at, completed_at, created_at, updated_at
           FROM atc_global_snapshots WHERE id = ? LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new SnapshotNotFoundError(id)
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

  async listActive(ownerServerId?: string | undefined): Promise<AtcGlobalSnapshot[]> {
    const conn = await this.pool.getConnection()
    try {
      if (ownerServerId !== undefined) {
        const [rows] = await conn.execute<SnapshotRow[]>(
          `SELECT id, snapshot_id, snapshot_type, entity_id, status, owner_server_id,
                  snapshot_nonce, snapshot_data, taken_at, completed_at, created_at, updated_at
           FROM atc_global_snapshots
           WHERE status IN ('pending', 'in_progress') AND owner_server_id = ?
           ORDER BY created_at ASC`,
          [ownerServerId]
        )
        return rows.map(mapRow)
      }
      const [rows] = await conn.execute<SnapshotRow[]>(
        `SELECT id, snapshot_id, snapshot_type, entity_id, status, owner_server_id,
                snapshot_nonce, snapshot_data, taken_at, completed_at, created_at, updated_at
         FROM atc_global_snapshots WHERE status IN ('pending', 'in_progress') ORDER BY created_at ASC`
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
        `DELETE FROM atc_global_snapshots
         WHERE status IN ('completed', 'failed', 'expired')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
