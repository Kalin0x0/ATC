import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeProtocolPool } from './pool.js'
import { generateId } from './id.js'
import { HandshakeNotFoundError, DuplicateHandshakeError } from './errors.js'

export type AtcHandshakeType = 'initiate' | 'acknowledge' | 'complete' | 'reject' | 'timeout' | 'custom'
export type AtcHandshakeStatus = 'pending' | 'acknowledged' | 'completed' | 'rejected' | 'timed_out'

export interface AtcRuntimeHandshake {
  id: string
  handshakeId: string
  handshakeType: AtcHandshakeType
  status: AtcHandshakeStatus
  ownerServerId: string
  remoteServerId: string
  handshakeNonce: string
  handshakeData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateHandshakeParams {
  handshakeId: string
  handshakeType: AtcHandshakeType
  ownerServerId: string
  remoteServerId: string
  handshakeNonce: string
  handshakeData?: Record<string, unknown> | undefined
}

interface RuntimeHandshakeRow extends RowDataPacket {
  id: string
  handshake_id: string
  handshake_type: string
  status: string
  owner_server_id: string
  remote_server_id: string
  handshake_nonce: string
  handshake_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeHandshakeRow): AtcRuntimeHandshake {
  let handshakeData: Record<string, unknown> = {}
  if (row.handshake_data) {
    try { handshakeData = JSON.parse(row.handshake_data) as Record<string, unknown> } catch { handshakeData = {} }
  }
  return {
    id: row.id,
    handshakeId: row.handshake_id,
    handshakeType: row.handshake_type as AtcHandshakeType,
    status: row.status as AtcHandshakeStatus,
    ownerServerId: row.owner_server_id,
    remoteServerId: row.remote_server_id,
    handshakeNonce: row.handshake_nonce,
    handshakeData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeHandshakeRepository {
  constructor(private readonly pool: RuntimeProtocolPool) {}

  async create(params: CreateHandshakeParams): Promise<AtcRuntimeHandshake> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const dataJson = JSON.stringify(params.handshakeData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_handshakes
             (id, handshake_id, handshake_type, status, owner_server_id, remote_server_id,
              handshake_nonce, handshake_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [id, params.handshakeId, params.handshakeType, params.ownerServerId,
           params.remoteServerId, params.handshakeNonce, dataJson],
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateHandshakeError(params.handshakeNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<RuntimeHandshakeRow[]>(
        `SELECT id, handshake_id, handshake_type, status, owner_server_id, remote_server_id,
                handshake_nonce, handshake_data, completed_at, created_at, updated_at
         FROM atc_runtime_handshakes WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new Error(`Runtime handshake not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeHandshake | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeHandshakeRow[]>(
        `SELECT id, handshake_id, handshake_type, status, owner_server_id, remote_server_id,
                handshake_nonce, handshake_data, completed_at, created_at, updated_at
         FROM atc_runtime_handshakes WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcHandshakeStatus,
    completedAt?: Date | undefined,
  ): Promise<AtcRuntimeHandshake> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeHandshakeRow[]>(
          `SELECT id, handshake_id, handshake_type, status, owner_server_id, remote_server_id,
                  handshake_nonce, handshake_data, completed_at, created_at, updated_at
           FROM atc_runtime_handshakes WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        if (!lockRows[0]) throw new HandshakeNotFoundError(id)

        if (completedAt !== undefined) {
          const completedAtStr = completedAt.toISOString().replace('T', ' ').replace('Z', '')
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_handshakes
             SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, completedAtStr, id],
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_handshakes SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id],
          )
        }

        const [rows] = await conn.execute<RuntimeHandshakeRow[]>(
          `SELECT id, handshake_id, handshake_type, status, owner_server_id, remote_server_id,
                  handshake_nonce, handshake_data, completed_at, created_at, updated_at
           FROM atc_runtime_handshakes WHERE id = ? LIMIT 1`,
          [id],
        )
        if (!rows[0]) throw new HandshakeNotFoundError(id)
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
        `DELETE FROM atc_runtime_handshakes
         WHERE status IN ('completed', 'rejected', 'timed_out')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
