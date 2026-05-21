import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { PersistenceRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { ArchiveNotFoundError, DuplicateArchiveError } from './errors.js'

export type AtcArchiveType = 'cold' | 'warm' | 'compressed' | 'offsite' | 'custom'
export type AtcArchiveStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface AtcSnapshotArchive {
  id: string
  archiveId: string
  sourceSnapshotId: string
  archiveType: AtcArchiveType
  compressionType: string | null
  status: AtcArchiveStatus
  ownerServerId: string
  archiveNonce: string
  archiveData: Record<string, unknown>
  archivedAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateArchiveParams {
  sourceSnapshotId: string
  archiveType: AtcArchiveType
  ownerServerId: string
  archiveNonce: string
  compressionType?: string | undefined
  archiveData?: Record<string, unknown> | undefined
}

interface ArchiveRow extends RowDataPacket {
  id: string
  archive_id: string
  source_snapshot_id: string
  archive_type: string
  compression_type: string | null
  status: string
  owner_server_id: string
  archive_nonce: string
  archive_data: string | null
  archived_at: Date
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: ArchiveRow): AtcSnapshotArchive {
  let archiveData: Record<string, unknown> = {}
  if (row.archive_data) {
    try { archiveData = JSON.parse(row.archive_data) as Record<string, unknown> } catch { archiveData = {} }
  }
  return {
    id: row.id,
    archiveId: row.archive_id,
    sourceSnapshotId: row.source_snapshot_id,
    archiveType: row.archive_type as AtcArchiveType,
    compressionType: row.compression_type,
    status: row.status as AtcArchiveStatus,
    ownerServerId: row.owner_server_id,
    archiveNonce: row.archive_nonce,
    archiveData,
    archivedAt: row.archived_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SnapshotArchiveRepository {
  constructor(private readonly pool: PersistenceRuntimePool) {}

  async create(params: CreateArchiveParams): Promise<AtcSnapshotArchive> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const archiveId = generateId()
      const archiveDataJson = JSON.stringify(params.archiveData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_snapshot_archives
             (id, archive_id, source_snapshot_id, archive_type, compression_type, status, owner_server_id,
              archive_nonce, archive_data, archived_at, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, NOW(3), NULL, NOW(3), NOW(3))`,
          [id, archiveId, params.sourceSnapshotId, params.archiveType,
           params.compressionType ?? null, params.ownerServerId,
           params.archiveNonce, archiveDataJson] as (string | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateArchiveError(params.archiveNonce)
        throw err
      }

      const [rows] = await conn.execute<ArchiveRow[]>(
        `SELECT id, archive_id, source_snapshot_id, archive_type, compression_type, status, owner_server_id,
                archive_nonce, archive_data, archived_at, completed_at, created_at, updated_at
         FROM atc_snapshot_archives WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Archive not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcSnapshotArchive | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ArchiveRow[]>(
        `SELECT id, archive_id, source_snapshot_id, archive_type, compression_type, status, owner_server_id,
                archive_nonce, archive_data, archived_at, completed_at, created_at, updated_at
         FROM atc_snapshot_archives WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcArchiveStatus, completedAt?: Date | undefined): Promise<AtcSnapshotArchive> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ArchiveRow[]>(
          `SELECT id FROM atc_snapshot_archives WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new ArchiveNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_snapshot_archives SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as string[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_snapshot_archives SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id]
          )
        }

        const [rows] = await conn.execute<ArchiveRow[]>(
          `SELECT id, archive_id, source_snapshot_id, archive_type, compression_type, status, owner_server_id,
                  archive_nonce, archive_data, archived_at, completed_at, created_at, updated_at
           FROM atc_snapshot_archives WHERE id = ? LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new ArchiveNotFoundError(id)
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
}
