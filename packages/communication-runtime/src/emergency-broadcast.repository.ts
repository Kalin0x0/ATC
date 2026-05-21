import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import type { CommunicationRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateBroadcastNonceError, EmergencyBroadcastNotFoundError } from './errors.js'

export type AtcBroadcastSeverity = 'info' | 'warning' | 'critical' | 'emergency'
export type AtcBroadcastStatus = 'active' | 'expired' | 'cancelled'

export interface AtcEmergencyBroadcast {
  id: string
  broadcastId: string
  broadcastNonce: string
  initiatedByPrincipalId: string
  message: string
  severity: AtcBroadcastSeverity
  status: AtcBroadcastStatus
  targetZoneId: string | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface EmergencyBroadcastRow extends RowDataPacket {
  id: string
  broadcast_id: string
  broadcast_nonce: string
  initiated_by_principal_id: string
  message: string
  severity: string
  status: string
  target_zone_id: string | null
  expires_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: EmergencyBroadcastRow): AtcEmergencyBroadcast {
  return {
    id: row.id,
    broadcastId: row.broadcast_id,
    broadcastNonce: row.broadcast_nonce,
    initiatedByPrincipalId: row.initiated_by_principal_id,
    message: row.message,
    severity: row.severity as AtcBroadcastSeverity,
    status: row.status as AtcBroadcastStatus,
    targetZoneId: row.target_zone_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class EmergencyBroadcastRepository {
  constructor(private readonly pool: CommunicationRuntimePool) {}

  async findById(broadcastId: string): Promise<AtcEmergencyBroadcast | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<EmergencyBroadcastRow[]>(
        `SELECT id, broadcast_id, broadcast_nonce, initiated_by_principal_id, message,
                severity, status, target_zone_id, expires_at, created_at, updated_at
         FROM atc_emergency_broadcasts
         WHERE broadcast_id = ?`,
        [broadcastId] as (string | number | boolean | null)[],
      )
      const row = rows[0]
      return row !== undefined ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcEmergencyBroadcast[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<EmergencyBroadcastRow[]>(
        `SELECT id, broadcast_id, broadcast_nonce, initiated_by_principal_id, message,
                severity, status, target_zone_id, expires_at, created_at, updated_at
         FROM atc_emergency_broadcasts
         WHERE status = 'active'
           AND (expires_at IS NULL OR expires_at > NOW(3))
         ORDER BY created_at ASC`,
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async create(params: {
    broadcastNonce: string
    initiatedByPrincipalId: string
    message: string
    severity: AtcBroadcastSeverity
    targetZoneId?: string
    expiresAt?: Date
  }): Promise<AtcEmergencyBroadcast> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const broadcastId = generateId()
      const targetZoneId = params.targetZoneId !== undefined ? params.targetZoneId : null
      const expiresAt =
        params.expiresAt !== undefined ? params.expiresAt.toISOString() : null
      const binds: (string | number | boolean | null)[] = [
        id,
        broadcastId,
        params.broadcastNonce,
        params.initiatedByPrincipalId,
        params.message,
        params.severity,
        'active',
        targetZoneId,
        expiresAt,
      ]
      await conn.execute(
        `INSERT INTO atc_emergency_broadcasts
           (id, broadcast_id, broadcast_nonce, initiated_by_principal_id, message,
            severity, status, target_zone_id, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        binds,
      )
      const broadcast = await this.findById(broadcastId)
      if (broadcast === null) {
        throw new Error(`Failed to retrieve broadcast after insert: ${broadcastId}`)
      }
      return broadcast
    } catch (err: unknown) {
      const e = err as { code?: string }
      if (e.code === 'ER_DUP_ENTRY') {
        throw new DuplicateBroadcastNonceError(params.broadcastNonce)
      }
      throw err
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    broadcastId: string,
    status: AtcBroadcastStatus,
  ): Promise<AtcEmergencyBroadcast> {
    const conn = await this.pool.getConnection()
    let committed = false
    try {
      await conn.beginTransaction()
      const [rows] = await conn.query<EmergencyBroadcastRow[]>(
        `SELECT id, broadcast_id, broadcast_nonce, initiated_by_principal_id, message,
                severity, status, target_zone_id, expires_at, created_at, updated_at
         FROM atc_emergency_broadcasts
         WHERE broadcast_id = ?
         FOR UPDATE`,
        [broadcastId] as (string | number | boolean | null)[],
      )
      const existing = rows[0]
      if (existing === undefined) {
        throw new EmergencyBroadcastNotFoundError(broadcastId)
      }
      await conn.execute(
        `UPDATE atc_emergency_broadcasts SET status = ?, updated_at = NOW(3) WHERE broadcast_id = ?`,
        [status, broadcastId] as (string | number | boolean | null)[],
      )
      await conn.commit()
      committed = true
      return { ...mapRow(existing), status, updatedAt: new Date() }
    } catch (err) {
      if (!committed) await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async expireStale(): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute(
        `UPDATE atc_emergency_broadcasts
         SET status = 'expired', updated_at = NOW(3)
         WHERE status = 'active'
           AND expires_at < NOW(3)`,
      )
      return (result as ResultSetHeader).affectedRows
    } finally {
      conn.release()
    }
  }
}
