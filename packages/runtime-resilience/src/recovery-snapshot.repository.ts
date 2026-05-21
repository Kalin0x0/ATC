import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeResiliencePool } from './pool.js'
import { generateId } from './id.js'
import { RecoverySnapshotNotFoundError } from './errors.js'

export type AtcRecoverySnapshotType = 'full' | 'partial' | 'delta' | 'checkpoint' | 'custom'

export interface AtcRecoverySnapshot {
  id: string
  entityId: string
  snapshotType: AtcRecoverySnapshotType
  ownerServerId: string
  snapshotData: Record<string, unknown>
  sequenceNumber: number
  isApplied: boolean
  appliedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateRecoverySnapshotParams {
  entityId: string
  snapshotType: AtcRecoverySnapshotType
  ownerServerId: string
  snapshotData?: Record<string, unknown> | undefined
  sequenceNumber?: number | undefined
}

interface RecoverySnapshotRow extends RowDataPacket {
  id: string
  entity_id: string
  snapshot_type: string
  owner_server_id: string
  snapshot_data: string | null
  sequence_number: number
  is_applied: number
  applied_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RecoverySnapshotRow): AtcRecoverySnapshot {
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
    entityId: row.entity_id,
    snapshotType: row.snapshot_type as AtcRecoverySnapshotType,
    ownerServerId: row.owner_server_id,
    snapshotData,
    sequenceNumber: row.sequence_number,
    isApplied: row.is_applied === 1,
    appliedAt: row.applied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RecoverySnapshotRepository {
  constructor(private readonly pool: RuntimeResiliencePool) {}

  async create(params: CreateRecoverySnapshotParams): Promise<AtcRecoverySnapshot> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const snapshotDataJson = JSON.stringify(params.snapshotData ?? {})
      const sequenceNumber = params.sequenceNumber ?? 0

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_recovery_snapshots
           (id, entity_id, snapshot_type, owner_server_id, snapshot_data,
            sequence_number, is_applied, applied_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NOW(3), NOW(3))`,
        [
          id,
          params.entityId,
          params.snapshotType,
          params.ownerServerId,
          snapshotDataJson,
          sequenceNumber,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<RecoverySnapshotRow[]>(
        `SELECT id, entity_id, snapshot_type, owner_server_id, snapshot_data,
                sequence_number, is_applied, applied_at, created_at, updated_at
         FROM atc_recovery_snapshots
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Recovery snapshot not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRecoverySnapshot | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RecoverySnapshotRow[]>(
        `SELECT id, entity_id, snapshot_type, owner_server_id, snapshot_data,
                sequence_number, is_applied, applied_at, created_at, updated_at
         FROM atc_recovery_snapshots
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

  async markApplied(id: string): Promise<AtcRecoverySnapshot> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RecoverySnapshotRow[]>(
          `SELECT id, entity_id, snapshot_type, owner_server_id, snapshot_data,
                  sequence_number, is_applied, applied_at, created_at, updated_at
           FROM atc_recovery_snapshots
           WHERE id = ?
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new RecoverySnapshotNotFoundError(id)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_recovery_snapshots
           SET is_applied = 1, applied_at = NOW(3), updated_at = NOW(3)
           WHERE id = ?`,
          [id]
        )

        const [rows] = await conn.execute<RecoverySnapshotRow[]>(
          `SELECT id, entity_id, snapshot_type, owner_server_id, snapshot_data,
                  sequence_number, is_applied, applied_at, created_at, updated_at
           FROM atc_recovery_snapshots
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new RecoverySnapshotNotFoundError(id)

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

  async listByEntity(entityId: string): Promise<AtcRecoverySnapshot[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RecoverySnapshotRow[]>(
        `SELECT id, entity_id, snapshot_type, owner_server_id, snapshot_data,
                sequence_number, is_applied, applied_at, created_at, updated_at
         FROM atc_recovery_snapshots
         WHERE entity_id = ?
         ORDER BY sequence_number ASC`,
        [entityId]
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async listUnapplied(ownerServerId?: string | undefined): Promise<AtcRecoverySnapshot[]> {
    const conn = await this.pool.getConnection()
    try {
      if (ownerServerId !== undefined) {
        const [rows] = await conn.execute<RecoverySnapshotRow[]>(
          `SELECT id, entity_id, snapshot_type, owner_server_id, snapshot_data,
                  sequence_number, is_applied, applied_at, created_at, updated_at
           FROM atc_recovery_snapshots
           WHERE is_applied = 0
             AND owner_server_id = ?
           ORDER BY created_at ASC`,
          [ownerServerId]
        )
        return rows.map(mapRow)
      }
      const [rows] = await conn.execute<RecoverySnapshotRow[]>(
        `SELECT id, entity_id, snapshot_type, owner_server_id, snapshot_data,
                sequence_number, is_applied, applied_at, created_at, updated_at
         FROM atc_recovery_snapshots
         WHERE is_applied = 0
         ORDER BY created_at ASC`
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }
}
