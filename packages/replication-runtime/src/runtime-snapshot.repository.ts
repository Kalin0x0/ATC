import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReplicationRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { SnapshotNotFoundError } from './errors.js'

export type AtcSnapshotType = 'full' | 'delta' | 'checkpoint'

export interface AtcRuntimeSnapshot {
  id: string
  snapshotId: string
  entityId: string
  snapshotType: AtcSnapshotType
  ownerServerId: string
  snapshotData: Record<string, unknown>
  sequenceNumber: number
  isReplayed: boolean
  replayedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateSnapshotParams {
  entityId: string
  snapshotType: AtcSnapshotType
  ownerServerId: string
  snapshotData: Record<string, unknown>
  sequenceNumber: number
}

interface RuntimeSnapshotRow extends RowDataPacket {
  id: string
  snapshot_id: string
  entity_id: string
  snapshot_type: string
  owner_server_id: string
  snapshot_data: string | null
  sequence_number: number
  is_replayed: number
  replayed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeSnapshotRow): AtcRuntimeSnapshot {
  let snapshotData: Record<string, unknown> = {}
  if (row.snapshot_data) {
    try {
      snapshotData = JSON.parse(row.snapshot_data) as Record<string, unknown>
    } catch {
      snapshotData = {}
    }
  }
  return {
    id: row.id,
    snapshotId: row.snapshot_id,
    entityId: row.entity_id,
    snapshotType: row.snapshot_type as AtcSnapshotType,
    ownerServerId: row.owner_server_id,
    snapshotData,
    sequenceNumber: row.sequence_number,
    isReplayed: row.is_replayed === 1,
    replayedAt: row.replayed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeSnapshotRepository {
  constructor(private readonly pool: ReplicationRuntimePool) {}

  async findById(snapshotId: string): Promise<AtcRuntimeSnapshot | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeSnapshotRow[]>(
        `SELECT id, snapshot_id, entity_id, snapshot_type, owner_server_id, snapshot_data,
                sequence_number, is_replayed, replayed_at, created_at, updated_at
         FROM atc_runtime_snapshots
         WHERE snapshot_id = ?
         LIMIT 1`,
        [snapshotId]
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async create(params: CreateSnapshotParams): Promise<AtcRuntimeSnapshot> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const snapshotId = generateId()
      const snapshotDataJson = JSON.stringify(params.snapshotData)

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_runtime_snapshots
           (id, snapshot_id, entity_id, snapshot_type, owner_server_id, snapshot_data,
            sequence_number, is_replayed, replayed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, NOW(3), NOW(3))`,
        [
          id,
          snapshotId,
          params.entityId,
          params.snapshotType,
          params.ownerServerId,
          snapshotDataJson,
          params.sequenceNumber,
        ]
      )

      const [rows] = await conn.execute<RuntimeSnapshotRow[]>(
        `SELECT id, snapshot_id, entity_id, snapshot_type, owner_server_id, snapshot_data,
                sequence_number, is_replayed, replayed_at, created_at, updated_at
         FROM atc_runtime_snapshots
         WHERE snapshot_id = ?
         LIMIT 1`,
        [snapshotId]
      )
      const row = rows[0]
      if (!row) throw new Error(`Snapshot not found after insert: ${snapshotId}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async markReplayed(snapshotId: string): Promise<AtcRuntimeSnapshot> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeSnapshotRow[]>(
          `SELECT id, snapshot_id, entity_id, snapshot_type, owner_server_id, snapshot_data,
                  sequence_number, is_replayed, replayed_at, created_at, updated_at
           FROM atc_runtime_snapshots
           WHERE snapshot_id = ?
           FOR UPDATE`,
          [snapshotId]
        )
        const lockRow = lockRows[0]
        if (!lockRow) {
          throw new SnapshotNotFoundError(snapshotId)
        }

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_runtime_snapshots
           SET is_replayed = 1, replayed_at = NOW(3), updated_at = NOW(3)
           WHERE snapshot_id = ?`,
          [snapshotId]
        )

        const [rows] = await conn.execute<RuntimeSnapshotRow[]>(
          `SELECT id, snapshot_id, entity_id, snapshot_type, owner_server_id, snapshot_data,
                  sequence_number, is_replayed, replayed_at, created_at, updated_at
           FROM atc_runtime_snapshots
           WHERE snapshot_id = ?
           LIMIT 1`,
          [snapshotId]
        )
        const row = rows[0]
        if (!row) {
          throw new SnapshotNotFoundError(snapshotId)
        }

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

  async listByEntityId(entityId: string): Promise<AtcRuntimeSnapshot[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeSnapshotRow[]>(
        `SELECT id, snapshot_id, entity_id, snapshot_type, owner_server_id, snapshot_data,
                sequence_number, is_replayed, replayed_at, created_at, updated_at
         FROM atc_runtime_snapshots
         WHERE entity_id = ?
         ORDER BY sequence_number ASC`,
        [entityId]
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async deleteOld(entityId: string, keepCount: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_runtime_snapshots
         WHERE entity_id = ?
           AND id NOT IN (
             SELECT id FROM (
               SELECT id FROM atc_runtime_snapshots
               WHERE entity_id = ?
               ORDER BY sequence_number DESC
               LIMIT ?
             ) AS keep
           )`,
        [entityId, entityId, keepCount]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
