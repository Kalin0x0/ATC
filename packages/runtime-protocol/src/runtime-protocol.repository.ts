import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeProtocolPool } from './pool.js'
import { generateId } from './id.js'
import { ProtocolNotFoundError, DuplicateProtocolError } from './errors.js'

export type AtcProtocolType = 'negotiation' | 'federation' | 'bridge' | 'handshake' | 'contract' | 'custom'
export type AtcProtocolStatus = 'active' | 'paused' | 'terminated' | 'degraded'

export interface AtcRuntimeProtocol {
  id: string
  protocolId: string
  protocolType: AtcProtocolType
  status: AtcProtocolStatus
  ownerServerId: string
  protocolNonce: string
  protocolData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface CreateProtocolParams {
  protocolId: string
  protocolType: AtcProtocolType
  ownerServerId: string
  protocolNonce: string
  protocolData?: Record<string, unknown> | undefined
}

interface RuntimeProtocolRow extends RowDataPacket {
  id: string
  protocol_id: string
  protocol_type: string
  status: string
  owner_server_id: string
  protocol_nonce: string
  protocol_data: string | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeProtocolRow): AtcRuntimeProtocol {
  let protocolData: Record<string, unknown> = {}
  if (row.protocol_data) {
    try { protocolData = JSON.parse(row.protocol_data) as Record<string, unknown> } catch { protocolData = {} }
  }
  return {
    id: row.id,
    protocolId: row.protocol_id,
    protocolType: row.protocol_type as AtcProtocolType,
    status: row.status as AtcProtocolStatus,
    ownerServerId: row.owner_server_id,
    protocolNonce: row.protocol_nonce,
    protocolData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeProtocolRepository {
  constructor(private readonly pool: RuntimeProtocolPool) {}

  async create(params: CreateProtocolParams): Promise<AtcRuntimeProtocol> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const dataJson = JSON.stringify(params.protocolData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_protocols
             (id, protocol_id, protocol_type, status, owner_server_id, protocol_nonce,
              protocol_data, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?, ?, NOW(3), NOW(3))`,
          [id, params.protocolId, params.protocolType, params.ownerServerId,
           params.protocolNonce, dataJson],
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateProtocolError(params.protocolNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<RuntimeProtocolRow[]>(
        `SELECT id, protocol_id, protocol_type, status, owner_server_id, protocol_nonce,
                protocol_data, created_at, updated_at
         FROM atc_runtime_protocols WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new Error(`Runtime protocol not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeProtocol | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeProtocolRow[]>(
        `SELECT id, protocol_id, protocol_type, status, owner_server_id, protocol_nonce,
                protocol_data, created_at, updated_at
         FROM atc_runtime_protocols WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcProtocolStatus): Promise<AtcRuntimeProtocol> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeProtocolRow[]>(
          `SELECT id, protocol_id, protocol_type, status, owner_server_id, protocol_nonce,
                  protocol_data, created_at, updated_at
           FROM atc_runtime_protocols WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        if (!lockRows[0]) throw new ProtocolNotFoundError(id)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_runtime_protocols SET status = ?, updated_at = NOW(3) WHERE id = ?`,
          [status, id],
        )

        const [rows] = await conn.execute<RuntimeProtocolRow[]>(
          `SELECT id, protocol_id, protocol_type, status, owner_server_id, protocol_nonce,
                  protocol_data, created_at, updated_at
           FROM atc_runtime_protocols WHERE id = ? LIMIT 1`,
          [id],
        )
        if (!rows[0]) throw new ProtocolNotFoundError(id)
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

  async listActive(ownerServerId?: string | undefined): Promise<AtcRuntimeProtocol[]> {
    const conn = await this.pool.getConnection()
    try {
      if (ownerServerId !== undefined) {
        const [rows] = await conn.execute<RuntimeProtocolRow[]>(
          `SELECT id, protocol_id, protocol_type, status, owner_server_id, protocol_nonce,
                  protocol_data, created_at, updated_at
           FROM atc_runtime_protocols
           WHERE status = 'active' AND owner_server_id = ?
           ORDER BY created_at ASC`,
          [ownerServerId],
        )
        return rows.map(mapRow)
      }
      const [rows] = await conn.execute<RuntimeProtocolRow[]>(
        `SELECT id, protocol_id, protocol_type, status, owner_server_id, protocol_nonce,
                protocol_data, created_at, updated_at
         FROM atc_runtime_protocols
         WHERE status = 'active'
         ORDER BY created_at ASC`,
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
        `DELETE FROM atc_runtime_protocols
         WHERE status IN ('terminated', 'degraded')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
