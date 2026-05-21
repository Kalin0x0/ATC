import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeGatewayPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateGatewayError, GatewayNotFoundError } from './errors.js'

export type AtcGatewayType = 'api' | 'proxy' | 'mesh' | 'edge' | 'custom'
export type AtcGatewayStatus = 'pending' | 'active' | 'suspended' | 'failed' | 'expired'

export interface AtcRuntimeGateway {
  id: string; gatewayId: string; gatewayType: AtcGatewayType; status: AtcGatewayStatus
  ownerServerId: string; gatewayNonce: string; gatewayData: Record<string, unknown>
  activatedAt: Date | null; createdAt: Date; updatedAt: Date
}

export interface CreateGatewayParams {
  gatewayType: AtcGatewayType; ownerServerId: string; gatewayNonce: string
  gatewayData?: Record<string, unknown> | undefined
}

interface GatewayRow extends RowDataPacket {
  id: string; gateway_id: string; gateway_type: string; status: string
  owner_server_id: string; gateway_nonce: string; gateway_data: string | null
  activated_at: Date | null; created_at: Date; updated_at: Date
}

function mapRow(row: GatewayRow): AtcRuntimeGateway {
  return {
    id: row.id, gatewayId: row.gateway_id,
    gatewayType: row.gateway_type as AtcGatewayType, status: row.status as AtcGatewayStatus,
    ownerServerId: row.owner_server_id, gatewayNonce: row.gateway_nonce,
    gatewayData: row.gateway_data ? (JSON.parse(row.gateway_data) as Record<string, unknown>) : {},
    activatedAt: row.activated_at, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export class RuntimeGatewayRepository {
  constructor(private readonly pool: RuntimeGatewayPool) {}

  async create(params: CreateGatewayParams): Promise<AtcRuntimeGateway> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId(); const gatewayId = generateId()
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_gateway (id, gateway_id, gateway_type, status, owner_server_id, gateway_nonce, gateway_data, activated_at, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [id, gatewayId, params.gatewayType, params.ownerServerId, params.gatewayNonce, JSON.stringify(params.gatewayData ?? {})] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateGatewayError(params.gatewayNonce)
        throw err
      }
      const [rows] = await conn.execute<GatewayRow[]>(
        `SELECT id, gateway_id, gateway_type, status, owner_server_id, gateway_nonce, gateway_data, activated_at, created_at, updated_at FROM atc_runtime_gateway WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Gateway not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally { conn.release() }
  }

  async findById(id: string): Promise<AtcRuntimeGateway | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GatewayRow[]>(
        `SELECT id, gateway_id, gateway_type, status, owner_server_id, gateway_nonce, gateway_data, activated_at, created_at, updated_at FROM atc_runtime_gateway WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally { conn.release() }
  }

  async updateStatus(id: string, status: AtcGatewayStatus, activatedAt?: Date | undefined): Promise<AtcRuntimeGateway> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<GatewayRow[]>(
          `SELECT id, gateway_id, gateway_type, status, owner_server_id, gateway_nonce, gateway_data, activated_at, created_at, updated_at FROM atc_runtime_gateway WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new GatewayNotFoundError(id)
        if (activatedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_gateway SET status = ?, activated_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, activatedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_gateway SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id] as unknown[]
          )
        }
        const [rows] = await conn.execute<GatewayRow[]>(
          `SELECT id, gateway_id, gateway_type, status, owner_server_id, gateway_nonce, gateway_data, activated_at, created_at, updated_at FROM atc_runtime_gateway WHERE id = ? LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new GatewayNotFoundError(id)
        await conn.commit()
        return mapRow(rows[0])
      } catch (err) { await conn.rollback(); throw err }
    } finally { conn.release() }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_runtime_gateway WHERE status IN ('failed', 'expired', 'suspended') AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally { conn.release() }
  }
}
