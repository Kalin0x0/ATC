import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeProtocolPool } from './pool.js'
import { generateId } from './id.js'
import { RegistryEntryNotFoundError } from './errors.js'

export type AtcRegistryEntryType = 'service' | 'gateway' | 'broker' | 'proxy' | 'custom'
export type AtcRegistryStatus = 'registered' | 'deregistered' | 'unreachable'

export interface AtcProtocolRegistryEntry {
  id: string
  nodeId: string
  entryType: AtcRegistryEntryType
  status: AtcRegistryStatus
  ownerServerId: string
  endpointData: Record<string, unknown>
  registeredAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertRegistryParams {
  nodeId: string
  entryType: AtcRegistryEntryType
  ownerServerId: string
  endpointData?: Record<string, unknown> | undefined
}

interface ProtocolRegistryRow extends RowDataPacket {
  id: string
  node_id: string
  entry_type: string
  status: string
  owner_server_id: string
  endpoint_data: string | null
  registered_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: ProtocolRegistryRow): AtcProtocolRegistryEntry {
  let endpointData: Record<string, unknown> = {}
  if (row.endpoint_data) {
    try { endpointData = JSON.parse(row.endpoint_data) as Record<string, unknown> } catch { endpointData = {} }
  }
  return {
    id: row.id,
    nodeId: row.node_id,
    entryType: row.entry_type as AtcRegistryEntryType,
    status: row.status as AtcRegistryStatus,
    ownerServerId: row.owner_server_id,
    endpointData,
    registeredAt: row.registered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ProtocolRegistryRepository {
  constructor(private readonly pool: RuntimeProtocolPool) {}

  async upsert(params: UpsertRegistryParams): Promise<AtcProtocolRegistryEntry> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const dataJson = JSON.stringify(params.endpointData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_protocol_registry
           (id, node_id, entry_type, status, owner_server_id, endpoint_data,
            registered_at, created_at, updated_at)
         VALUES (?, ?, ?, 'registered', ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           entry_type = VALUES(entry_type),
           status = 'registered',
           owner_server_id = VALUES(owner_server_id),
           endpoint_data = VALUES(endpoint_data),
           registered_at = NOW(3),
           updated_at = NOW(3)`,
        [id, params.nodeId, params.entryType, params.ownerServerId, dataJson],
      )

      const [rows] = await conn.execute<ProtocolRegistryRow[]>(
        `SELECT id, node_id, entry_type, status, owner_server_id, endpoint_data,
                registered_at, created_at, updated_at
         FROM atc_protocol_registry WHERE node_id = ? LIMIT 1`,
        [params.nodeId],
      )
      if (!rows[0]) throw new Error(`Registry entry not found after upsert: ${params.nodeId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByNodeId(nodeId: string): Promise<AtcProtocolRegistryEntry | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ProtocolRegistryRow[]>(
        `SELECT id, node_id, entry_type, status, owner_server_id, endpoint_data,
                registered_at, created_at, updated_at
         FROM atc_protocol_registry WHERE node_id = ? LIMIT 1`,
        [nodeId],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(nodeId: string, status: AtcRegistryStatus): Promise<AtcProtocolRegistryEntry> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ProtocolRegistryRow[]>(
          `SELECT id, node_id, entry_type, status, owner_server_id, endpoint_data,
                  registered_at, created_at, updated_at
           FROM atc_protocol_registry WHERE node_id = ? LIMIT 1 FOR UPDATE`,
          [nodeId],
        )
        if (!lockRows[0]) throw new RegistryEntryNotFoundError(nodeId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_protocol_registry SET status = ?, updated_at = NOW(3) WHERE node_id = ?`,
          [status, nodeId],
        )

        const [rows] = await conn.execute<ProtocolRegistryRow[]>(
          `SELECT id, node_id, entry_type, status, owner_server_id, endpoint_data,
                  registered_at, created_at, updated_at
           FROM atc_protocol_registry WHERE node_id = ? LIMIT 1`,
          [nodeId],
        )
        if (!rows[0]) throw new RegistryEntryNotFoundError(nodeId)
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
        `DELETE FROM atc_protocol_registry
         WHERE status IN ('deregistered', 'unreachable')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
