import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReconciliationRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { SnapshotReplayNotFoundError } from './errors.js'

export type AtcReplayStatus = 'pending' | 'replaying' | 'completed' | 'failed'

export interface AtcSnapshotReplay {
  id: string
  replayId: string
  entityId: string
  snapshotId: string
  replayStatus: AtcReplayStatus
  replayData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateSnapshotReplayParams {
  entityId: string
  snapshotId: string
  replayData?: Record<string, unknown> | undefined
}

interface SnapshotReplayRow extends RowDataPacket {
  id: string
  replay_id: string
  entity_id: string
  snapshot_id: string
  replay_status: string
  replay_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: SnapshotReplayRow): AtcSnapshotReplay {
  let replayData: Record<string, unknown> = {}
  if (row.replay_data) {
    try {
      replayData = JSON.parse(row.replay_data) as Record<string, unknown>
    } catch {
      replayData = {}
    }
  }
  return {
    id: row.id,
    replayId: row.replay_id,
    entityId: row.entity_id,
    snapshotId: row.snapshot_id,
    replayStatus: row.replay_status as AtcReplayStatus,
    replayData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SnapshotReplayRepository {
  constructor(private readonly pool: ReconciliationRuntimePool) {}

  async findById(replayId: string): Promise<AtcSnapshotReplay | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SnapshotReplayRow[]>(
        `SELECT id, replay_id, entity_id, snapshot_id, replay_status,
                replay_data, completed_at, created_at, updated_at
         FROM atc_snapshot_replay
         WHERE replay_id = ?
         LIMIT 1`,
        [replayId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async create(params: CreateSnapshotReplayParams): Promise<AtcSnapshotReplay> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const replayId = generateId()
      const replayDataJson = params.replayData ? JSON.stringify(params.replayData) : null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_snapshot_replay
           (id, replay_id, entity_id, snapshot_id, replay_status, replay_data, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', ?, NULL, NOW(3), NOW(3))`,
        [
          id,
          replayId,
          params.entityId,
          params.snapshotId,
          replayDataJson,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<SnapshotReplayRow[]>(
        `SELECT id, replay_id, entity_id, snapshot_id, replay_status,
                replay_data, completed_at, created_at, updated_at
         FROM atc_snapshot_replay
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Snapshot replay not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async complete(replayId: string): Promise<AtcSnapshotReplay> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<SnapshotReplayRow[]>(
          `SELECT id, replay_id, entity_id, snapshot_id, replay_status,
                  replay_data, completed_at, created_at, updated_at
           FROM atc_snapshot_replay
           WHERE replay_id = ?
           LIMIT 1
           FOR UPDATE`,
          [replayId]
        )
        if (!rows[0]) throw new SnapshotReplayNotFoundError(replayId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_snapshot_replay
           SET replay_status = 'completed', completed_at = NOW(3), updated_at = NOW(3)
           WHERE replay_id = ?`,
          [replayId]
        )

        const [updated] = await conn.execute<SnapshotReplayRow[]>(
          `SELECT id, replay_id, entity_id, snapshot_id, replay_status,
                  replay_data, completed_at, created_at, updated_at
           FROM atc_snapshot_replay
           WHERE replay_id = ?
           LIMIT 1`,
          [replayId]
        )
        if (!updated[0]) throw new SnapshotReplayNotFoundError(replayId)

        await conn.commit()
        return mapRow(updated[0])
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async fail(replayId: string): Promise<AtcSnapshotReplay> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<SnapshotReplayRow[]>(
          `SELECT id, replay_id, entity_id, snapshot_id, replay_status,
                  replay_data, completed_at, created_at, updated_at
           FROM atc_snapshot_replay
           WHERE replay_id = ?
           LIMIT 1
           FOR UPDATE`,
          [replayId]
        )
        if (!rows[0]) throw new SnapshotReplayNotFoundError(replayId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_snapshot_replay
           SET replay_status = 'failed', updated_at = NOW(3)
           WHERE replay_id = ?`,
          [replayId]
        )

        const [updated] = await conn.execute<SnapshotReplayRow[]>(
          `SELECT id, replay_id, entity_id, snapshot_id, replay_status,
                  replay_data, completed_at, created_at, updated_at
           FROM atc_snapshot_replay
           WHERE replay_id = ?
           LIMIT 1`,
          [replayId]
        )
        if (!updated[0]) throw new SnapshotReplayNotFoundError(replayId)

        await conn.commit()
        return mapRow(updated[0])
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async listPending(): Promise<AtcSnapshotReplay[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SnapshotReplayRow[]>(
        `SELECT id, replay_id, entity_id, snapshot_id, replay_status,
                replay_data, completed_at, created_at, updated_at
         FROM atc_snapshot_replay
         WHERE replay_status = 'pending'
         ORDER BY created_at ASC`
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }
}
