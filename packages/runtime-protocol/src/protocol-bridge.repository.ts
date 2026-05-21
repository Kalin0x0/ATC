import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeProtocolPool } from './pool.js'
import { generateId } from './id.js'
import { BridgeNotFoundError } from './errors.js'

export type AtcBridgeType = 'grpc' | 'http' | 'websocket' | 'tcp' | 'custom'
export type AtcBridgeStatus = 'active' | 'inactive' | 'failed' | 'draining'

export interface AtcProtocolBridge {
  id: string
  bridgeId: string
  bridgeType: AtcBridgeType
  status: AtcBridgeStatus
  ownerServerId: string
  remoteServerId: string
  bridgeData: Record<string, unknown>
  heartbeatAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertBridgeParams {
  bridgeId: string
  bridgeType: AtcBridgeType
  ownerServerId: string
  remoteServerId: string
  bridgeData?: Record<string, unknown> | undefined
}

interface ProtocolBridgeRow extends RowDataPacket {
  id: string
  bridge_id: string
  bridge_type: string
  status: string
  owner_server_id: string
  remote_server_id: string
  bridge_data: string | null
  heartbeat_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: ProtocolBridgeRow): AtcProtocolBridge {
  let bridgeData: Record<string, unknown> = {}
  if (row.bridge_data) {
    try { bridgeData = JSON.parse(row.bridge_data) as Record<string, unknown> } catch { bridgeData = {} }
  }
  return {
    id: row.id,
    bridgeId: row.bridge_id,
    bridgeType: row.bridge_type as AtcBridgeType,
    status: row.status as AtcBridgeStatus,
    ownerServerId: row.owner_server_id,
    remoteServerId: row.remote_server_id,
    bridgeData,
    heartbeatAt: row.heartbeat_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ProtocolBridgeRepository {
  constructor(private readonly pool: RuntimeProtocolPool) {}

  async upsert(params: UpsertBridgeParams): Promise<AtcProtocolBridge> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const dataJson = JSON.stringify(params.bridgeData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_protocol_bridges
           (id, bridge_id, bridge_type, status, owner_server_id, remote_server_id,
            bridge_data, heartbeat_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           bridge_type = VALUES(bridge_type),
           status = 'active',
           owner_server_id = VALUES(owner_server_id),
           remote_server_id = VALUES(remote_server_id),
           bridge_data = VALUES(bridge_data),
           heartbeat_at = NOW(3),
           updated_at = NOW(3)`,
        [id, params.bridgeId, params.bridgeType, params.ownerServerId,
         params.remoteServerId, dataJson],
      )

      const [rows] = await conn.execute<ProtocolBridgeRow[]>(
        `SELECT id, bridge_id, bridge_type, status, owner_server_id, remote_server_id,
                bridge_data, heartbeat_at, created_at, updated_at
         FROM atc_protocol_bridges WHERE bridge_id = ? LIMIT 1`,
        [params.bridgeId],
      )
      if (!rows[0]) throw new Error(`Protocol bridge not found after upsert: ${params.bridgeId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByBridgeId(bridgeId: string): Promise<AtcProtocolBridge | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ProtocolBridgeRow[]>(
        `SELECT id, bridge_id, bridge_type, status, owner_server_id, remote_server_id,
                bridge_data, heartbeat_at, created_at, updated_at
         FROM atc_protocol_bridges WHERE bridge_id = ? LIMIT 1`,
        [bridgeId],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async failBridge(bridgeId: string): Promise<AtcProtocolBridge> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ProtocolBridgeRow[]>(
          `SELECT id, bridge_id, bridge_type, status, owner_server_id, remote_server_id,
                  bridge_data, heartbeat_at, created_at, updated_at
           FROM atc_protocol_bridges WHERE bridge_id = ? LIMIT 1 FOR UPDATE`,
          [bridgeId],
        )
        if (!lockRows[0]) throw new BridgeNotFoundError(bridgeId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_protocol_bridges SET status = 'failed', updated_at = NOW(3) WHERE bridge_id = ?`,
          [bridgeId],
        )

        const [rows] = await conn.execute<ProtocolBridgeRow[]>(
          `SELECT id, bridge_id, bridge_type, status, owner_server_id, remote_server_id,
                  bridge_data, heartbeat_at, created_at, updated_at
           FROM atc_protocol_bridges WHERE bridge_id = ? LIMIT 1`,
          [bridgeId],
        )
        if (!rows[0]) throw new BridgeNotFoundError(bridgeId)
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
        `DELETE FROM atc_protocol_bridges
         WHERE status IN ('inactive', 'failed', 'draining')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
