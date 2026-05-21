import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeGatewayPool } from './pool.js'
import { generateId } from './id.js'
import { GatewayRoutingNotFoundError } from './errors.js'

export type AtcRoutingType = 'static' | 'dynamic' | 'weighted' | 'failover' | 'custom'
export type AtcRoutingStatus = 'active' | 'routing' | 'suspended' | 'expired'

export interface AtcGatewayRouting {
  id: string; routingId: string; routingType: AtcRoutingType; status: AtcRoutingStatus
  ownerServerId: string; routingData: Record<string, unknown>; syncedAt: Date
  createdAt: Date; updatedAt: Date
}

export interface SyncRoutingParams {
  routingId: string; routingType: AtcRoutingType; ownerServerId: string
  routingData?: Record<string, unknown> | undefined
}

interface RoutingRow extends RowDataPacket {
  id: string; routing_id: string; routing_type: string; status: string
  owner_server_id: string; routing_data: string | null; synced_at: Date
  created_at: Date; updated_at: Date
}

function mapRow(row: RoutingRow): AtcGatewayRouting {
  return {
    id: row.id, routingId: row.routing_id, routingType: row.routing_type as AtcRoutingType,
    status: row.status as AtcRoutingStatus, ownerServerId: row.owner_server_id,
    routingData: row.routing_data ? (JSON.parse(row.routing_data) as Record<string, unknown>) : {},
    syncedAt: row.synced_at, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export class GatewayRoutingRepository {
  constructor(private readonly pool: RuntimeGatewayPool) {}

  async upsert(params: SyncRoutingParams): Promise<AtcGatewayRouting> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const routingDataJson = JSON.stringify(params.routingData ?? {})
      await conn.beginTransaction()
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_gateway_routing (id, routing_id, routing_type, status, owner_server_id, routing_data, synced_at, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?, NOW(3), NOW(3), NOW(3)) ON DUPLICATE KEY UPDATE routing_type = VALUES(routing_type), owner_server_id = VALUES(owner_server_id), routing_data = VALUES(routing_data), synced_at = NOW(3), updated_at = NOW(3)`,
          [id, params.routingId, params.routingType, params.ownerServerId, routingDataJson] as unknown[]
        )
        const [rows] = await conn.execute<RoutingRow[]>(
          `SELECT id, routing_id, routing_type, status, owner_server_id, routing_data, synced_at, created_at, updated_at FROM atc_gateway_routing WHERE routing_id = ? LIMIT 1`,
          [params.routingId]
        )
        if (!rows[0]) throw new Error(`Routing not found after upsert: ${params.routingId}`)
        await conn.commit()
        return mapRow(rows[0])
      } catch (err) { await conn.rollback(); throw err }
    } finally { conn.release() }
  }

  async findByRoutingId(routingId: string): Promise<AtcGatewayRouting | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RoutingRow[]>(
        `SELECT id, routing_id, routing_type, status, owner_server_id, routing_data, synced_at, created_at, updated_at FROM atc_gateway_routing WHERE routing_id = ? LIMIT 1`,
        [routingId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally { conn.release() }
  }

  async updateStatus(routingId: string, status: AtcRoutingStatus): Promise<AtcGatewayRouting> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RoutingRow[]>(
          `SELECT id, routing_id, routing_type, status, owner_server_id, routing_data, synced_at, created_at, updated_at FROM atc_gateway_routing WHERE routing_id = ? LIMIT 1 FOR UPDATE`,
          [routingId]
        )
        if (!lockRows[0]) throw new GatewayRoutingNotFoundError(routingId)
        await conn.execute<ResultSetHeader>(
          `UPDATE atc_gateway_routing SET status = ?, updated_at = NOW(3) WHERE routing_id = ?`,
          [status, routingId] as unknown[]
        )
        const [rows] = await conn.execute<RoutingRow[]>(
          `SELECT id, routing_id, routing_type, status, owner_server_id, routing_data, synced_at, created_at, updated_at FROM atc_gateway_routing WHERE routing_id = ? LIMIT 1`,
          [routingId]
        )
        if (!rows[0]) throw new GatewayRoutingNotFoundError(routingId)
        await conn.commit()
        return mapRow(rows[0])
      } catch (err) { await conn.rollback(); throw err }
    } finally { conn.release() }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_gateway_routing WHERE status IN ('suspended', 'expired') AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally { conn.release() }
  }
}
