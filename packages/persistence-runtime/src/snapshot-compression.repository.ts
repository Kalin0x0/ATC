import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { PersistenceRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { CompressionNotFoundError, DuplicateCompressionError } from './errors.js'

export type AtcCompressionType = 'gzip' | 'lz4' | 'zstd' | 'brotli' | 'none' | 'custom'
export type AtcCompressionStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface AtcSnapshotCompression {
  id: string
  compressionId: string
  snapshotId: string
  compressionType: AtcCompressionType
  status: AtcCompressionStatus
  ownerServerId: string
  compressionNonce: string
  compressionData: Record<string, unknown>
  startedAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateCompressionParams {
  snapshotId: string
  compressionType: AtcCompressionType
  ownerServerId: string
  compressionNonce: string
  compressionData?: Record<string, unknown> | undefined
}

interface CompressionRow extends RowDataPacket {
  id: string
  compression_id: string
  snapshot_id: string
  compression_type: string
  status: string
  owner_server_id: string
  compression_nonce: string
  compression_data: string | null
  started_at: Date
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: CompressionRow): AtcSnapshotCompression {
  let compressionData: Record<string, unknown> = {}
  if (row.compression_data) {
    try { compressionData = JSON.parse(row.compression_data) as Record<string, unknown> } catch { compressionData = {} }
  }
  return {
    id: row.id,
    compressionId: row.compression_id,
    snapshotId: row.snapshot_id,
    compressionType: row.compression_type as AtcCompressionType,
    status: row.status as AtcCompressionStatus,
    ownerServerId: row.owner_server_id,
    compressionNonce: row.compression_nonce,
    compressionData,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SnapshotCompressionRepository {
  constructor(private readonly pool: PersistenceRuntimePool) {}

  async create(params: CreateCompressionParams): Promise<AtcSnapshotCompression> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const compressionId = generateId()
      const compressionDataJson = JSON.stringify(params.compressionData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_snapshot_compression
             (id, compression_id, snapshot_id, compression_type, status, owner_server_id,
              compression_nonce, compression_data, started_at, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, NOW(3), NULL, NOW(3), NOW(3))`,
          [id, compressionId, params.snapshotId, params.compressionType,
           params.ownerServerId, params.compressionNonce, compressionDataJson] as string[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateCompressionError(params.compressionNonce)
        throw err
      }

      const [rows] = await conn.execute<CompressionRow[]>(
        `SELECT id, compression_id, snapshot_id, compression_type, status, owner_server_id,
                compression_nonce, compression_data, started_at, completed_at, created_at, updated_at
         FROM atc_snapshot_compression WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Compression not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcSnapshotCompression | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CompressionRow[]>(
        `SELECT id, compression_id, snapshot_id, compression_type, status, owner_server_id,
                compression_nonce, compression_data, started_at, completed_at, created_at, updated_at
         FROM atc_snapshot_compression WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcCompressionStatus, completedAt?: Date | undefined): Promise<AtcSnapshotCompression> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<CompressionRow[]>(
          `SELECT id FROM atc_snapshot_compression WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new CompressionNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_snapshot_compression SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as string[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_snapshot_compression SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id]
          )
        }

        const [rows] = await conn.execute<CompressionRow[]>(
          `SELECT id, compression_id, snapshot_id, compression_type, status, owner_server_id,
                  compression_nonce, compression_data, started_at, completed_at, created_at, updated_at
           FROM atc_snapshot_compression WHERE id = ? LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new CompressionNotFoundError(id)
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
