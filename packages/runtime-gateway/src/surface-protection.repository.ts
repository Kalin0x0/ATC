import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeGatewayPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateSurfaceProtectionError, SurfaceProtectionNotFoundError } from './errors.js'

export type AtcProtectionType = 'firewall' | 'rate_limit' | 'auth_guard' | 'circuit_breaker' | 'custom'
export type AtcProtectionStatus = 'pending' | 'active' | 'breached' | 'expired'

export interface AtcSurfaceProtection {
  id: string; protectionId: string; protectionType: AtcProtectionType; status: AtcProtectionStatus
  ownerServerId: string; protectionNonce: string; protectionData: Record<string, unknown>
  activatedAt: Date | null; createdAt: Date; updatedAt: Date
}

export interface CreateProtectionParams {
  protectionType: AtcProtectionType; ownerServerId: string; protectionNonce: string
  protectionData?: Record<string, unknown> | undefined
}

interface ProtectionRow extends RowDataPacket {
  id: string; protection_id: string; protection_type: string; status: string
  owner_server_id: string; protection_nonce: string; protection_data: string | null
  activated_at: Date | null; created_at: Date; updated_at: Date
}

function mapRow(row: ProtectionRow): AtcSurfaceProtection {
  return {
    id: row.id, protectionId: row.protection_id,
    protectionType: row.protection_type as AtcProtectionType, status: row.status as AtcProtectionStatus,
    ownerServerId: row.owner_server_id, protectionNonce: row.protection_nonce,
    protectionData: row.protection_data ? (JSON.parse(row.protection_data) as Record<string, unknown>) : {},
    activatedAt: row.activated_at, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export class SurfaceProtectionRepository {
  constructor(private readonly pool: RuntimeGatewayPool) {}

  async create(params: CreateProtectionParams): Promise<AtcSurfaceProtection> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId(); const protectionId = generateId()
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_surface_protection (id, protection_id, protection_type, status, owner_server_id, protection_nonce, protection_data, activated_at, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [id, protectionId, params.protectionType, params.ownerServerId, params.protectionNonce, JSON.stringify(params.protectionData ?? {})] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateSurfaceProtectionError(params.protectionNonce)
        throw err
      }
      const [rows] = await conn.execute<ProtectionRow[]>(
        `SELECT id, protection_id, protection_type, status, owner_server_id, protection_nonce, protection_data, activated_at, created_at, updated_at FROM atc_surface_protection WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Protection not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally { conn.release() }
  }

  async findById(id: string): Promise<AtcSurfaceProtection | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ProtectionRow[]>(
        `SELECT id, protection_id, protection_type, status, owner_server_id, protection_nonce, protection_data, activated_at, created_at, updated_at FROM atc_surface_protection WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally { conn.release() }
  }

  async updateStatus(id: string, status: AtcProtectionStatus, activatedAt?: Date | undefined): Promise<AtcSurfaceProtection> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ProtectionRow[]>(
          `SELECT id, protection_id, protection_type, status, owner_server_id, protection_nonce, protection_data, activated_at, created_at, updated_at FROM atc_surface_protection WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new SurfaceProtectionNotFoundError(id)
        if (activatedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_surface_protection SET status = ?, activated_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, activatedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_surface_protection SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id] as unknown[]
          )
        }
        const [rows] = await conn.execute<ProtectionRow[]>(
          `SELECT id, protection_id, protection_type, status, owner_server_id, protection_nonce, protection_data, activated_at, created_at, updated_at FROM atc_surface_protection WHERE id = ? LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new SurfaceProtectionNotFoundError(id)
        await conn.commit()
        return mapRow(rows[0])
      } catch (err) { await conn.rollback(); throw err }
    } finally { conn.release() }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_surface_protection WHERE status IN ('breached', 'expired') AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally { conn.release() }
  }
}
