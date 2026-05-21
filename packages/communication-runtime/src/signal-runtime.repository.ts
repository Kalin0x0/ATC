import type { RowDataPacket } from 'mysql2'
import type { CommunicationRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { SignalNotFoundError } from './errors.js'

export type AtcSignalType = 'radio' | 'digital' | 'emergency' | 'encrypted' | 'broadcast'
export type AtcSignalStatus = 'active' | 'degraded' | 'lost' | 'jammed'

export interface AtcSignalRuntime {
  id: string
  signalId: string
  channelId: string | null
  signalType: AtcSignalType
  strength: number
  status: AtcSignalStatus
  originZoneId: string | null
  ownerServerId: string
  lastTickAt: Date
  createdAt: Date
  updatedAt: Date
}

interface SignalRuntimeRow extends RowDataPacket {
  id: string
  signal_id: string
  channel_id: string | null
  signal_type: string
  strength: number
  status: string
  origin_zone_id: string | null
  owner_server_id: string
  last_tick_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: SignalRuntimeRow): AtcSignalRuntime {
  return {
    id: row.id,
    signalId: row.signal_id,
    channelId: row.channel_id,
    signalType: row.signal_type as AtcSignalType,
    strength: row.strength,
    status: row.status as AtcSignalStatus,
    originZoneId: row.origin_zone_id,
    ownerServerId: row.owner_server_id,
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SignalRuntimeRepository {
  constructor(private readonly pool: CommunicationRuntimePool) {}

  async findById(signalId: string): Promise<AtcSignalRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<SignalRuntimeRow[]>(
        `SELECT id, signal_id, channel_id, signal_type, strength, status,
                origin_zone_id, owner_server_id, last_tick_at, created_at, updated_at
         FROM atc_signal_runtime
         WHERE signal_id = ?`,
        [signalId] as (string | number | boolean | null)[],
      )
      const row = rows[0]
      return row !== undefined ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcSignalRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<SignalRuntimeRow[]>(
        `SELECT id, signal_id, channel_id, signal_type, strength, status,
                origin_zone_id, owner_server_id, last_tick_at, created_at, updated_at
         FROM atc_signal_runtime
         WHERE status = 'active'
         ORDER BY created_at ASC`,
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async upsert(params: {
    signalId: string
    channelId?: string
    signalType: AtcSignalType
    strength: number
    status?: AtcSignalStatus
    originZoneId?: string
    ownerServerId: string
  }): Promise<AtcSignalRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const status = params.status !== undefined ? params.status : 'active'
      const channelId = params.channelId !== undefined ? params.channelId : null
      const originZoneId = params.originZoneId !== undefined ? params.originZoneId : null
      const binds: (string | number | boolean | null)[] = [
        id,
        params.signalId,
        channelId,
        params.signalType,
        params.strength,
        status,
        originZoneId,
        params.ownerServerId,
        params.strength,
        status,
      ]
      await conn.query(
        `INSERT INTO atc_signal_runtime
           (id, signal_id, channel_id, signal_type, strength, status,
            origin_zone_id, owner_server_id, last_tick_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3))
         ON DUPLICATE KEY UPDATE
           strength = ?,
           status = ?,
           last_tick_at = NOW(3),
           updated_at = NOW(3)`,
        binds,
      )
      const signal = await this.findById(params.signalId)
      if (signal === null) {
        throw new Error(`Failed to retrieve signal after upsert: ${params.signalId}`)
      }
      return signal
    } finally {
      conn.release()
    }
  }

  async updateStatus(signalId: string, status: AtcSignalStatus): Promise<AtcSignalRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      const [rows] = await conn.query<SignalRuntimeRow[]>(
        `SELECT id, signal_id, channel_id, signal_type, strength, status,
                origin_zone_id, owner_server_id, last_tick_at, created_at, updated_at
         FROM atc_signal_runtime
         WHERE signal_id = ?
         FOR UPDATE`,
        [signalId] as (string | number | boolean | null)[],
      )
      const existing = rows[0]
      if (existing === undefined) {
        await conn.rollback()
        throw new SignalNotFoundError(signalId)
      }
      const now = new Date()
      await conn.execute(
        `UPDATE atc_signal_runtime SET status = ?, updated_at = ? WHERE signal_id = ?`,
        [status, now, signalId] as (string | number | boolean | null)[],
      )
      await conn.commit()
      return { ...mapRow(existing), status, updatedAt: now }
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async listStale(thresholdMs: number): Promise<AtcSignalRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const thresholdSeconds = thresholdMs / 1000
      const [rows] = await conn.query<SignalRuntimeRow[]>(
        `SELECT id, signal_id, channel_id, signal_type, strength, status,
                origin_zone_id, owner_server_id, last_tick_at, created_at, updated_at
         FROM atc_signal_runtime
         WHERE last_tick_at < NOW(3) - INTERVAL ? SECOND`,
        [thresholdSeconds] as (string | number | boolean | null)[],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async deleteById(signalId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `DELETE FROM atc_signal_runtime WHERE signal_id = ?`,
        [signalId] as (string | number | boolean | null)[],
      )
    } finally {
      conn.release()
    }
  }
}
