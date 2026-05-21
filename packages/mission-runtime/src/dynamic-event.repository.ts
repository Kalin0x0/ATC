import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { MissionRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateEventNonceError, DynamicEventNotFoundError } from './errors.js'

export type AtcDynamicEventType =
  | 'ambush'
  | 'accident'
  | 'weather'
  | 'crowd'
  | 'crime'
  | 'emergency'
  | 'custom'

export type AtcDynamicEventStatus =
  | 'pending'
  | 'active'
  | 'resolved'
  | 'expired'
  | 'cancelled'

export interface AtcDynamicEvent {
  id: string
  eventId: string
  eventNonce: string
  eventType: AtcDynamicEventType
  status: AtcDynamicEventStatus
  triggerData: Record<string, unknown>
  zoneId: string | null
  ownerServerId: string | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface DynamicEventRow extends RowDataPacket {
  id: string
  event_id: string
  event_nonce: string
  event_type: string
  status: string
  trigger_data: string | null
  zone_id: string | null
  owner_server_id: string | null
  expires_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: DynamicEventRow): AtcDynamicEvent {
  let triggerData: Record<string, unknown> = {}
  if (row.trigger_data) {
    try {
      triggerData = JSON.parse(row.trigger_data) as Record<string, unknown>
    } catch {
      triggerData = {}
    }
  }
  return {
    id: row.id,
    eventId: row.event_id,
    eventNonce: row.event_nonce,
    eventType: row.event_type as AtcDynamicEventType,
    status: row.status as AtcDynamicEventStatus,
    triggerData,
    zoneId: row.zone_id,
    ownerServerId: row.owner_server_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateDynamicEventParams {
  eventNonce: string
  eventType: AtcDynamicEventType
  triggerData?: Record<string, unknown>
  zoneId?: string
  ownerServerId?: string
  expiresAt?: Date
}

export class DynamicEventRepository {
  constructor(private readonly pool: MissionRuntimePool) {}

  async findById(eventId: string): Promise<AtcDynamicEvent | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DynamicEventRow[]>(
        'SELECT * FROM atc_dynamic_events WHERE event_id = ? LIMIT 1',
        [eventId],
      )
      const row = rows[0]
      return row !== undefined ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcDynamicEvent[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DynamicEventRow[]>(
        `SELECT * FROM atc_dynamic_events
         WHERE status IN ('pending', 'active')
           AND (expires_at IS NULL OR expires_at > NOW(3))
         ORDER BY created_at ASC`,
        [],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async create(params: CreateDynamicEventParams): Promise<AtcDynamicEvent> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const eventId = generateId()
      const triggerData = JSON.stringify(params.triggerData ?? {})
      const expiresAt = params.expiresAt ? params.expiresAt.toISOString() : null
      const binds: (string | number | boolean | null)[] = [
        id,
        eventId,
        params.eventNonce,
        params.eventType,
        'pending',
        triggerData,
        params.zoneId ?? null,
        params.ownerServerId ?? null,
        expiresAt,
      ]
      await conn.execute<DynamicEventRow[]>(
        `INSERT INTO atc_dynamic_events
         (id, event_id, event_nonce, event_type, status, trigger_data, zone_id, owner_server_id, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        binds,
      )
      const event = await this.findById(eventId)
      if (!event) throw new DynamicEventNotFoundError(eventId)
      return event
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'ER_DUP_ENTRY'
      ) {
        throw new DuplicateEventNonceError(params.eventNonce)
      }
      throw err
    } finally {
      conn.release()
    }
  }

  async updateStatus(eventId: string, status: AtcDynamicEventStatus): Promise<AtcDynamicEvent> {
    const conn = await this.pool.getConnection()
    let committed = false
    try {
      await conn.beginTransaction()

      const [rows] = await conn.execute<DynamicEventRow[]>(
        'SELECT * FROM atc_dynamic_events WHERE event_id = ? FOR UPDATE',
        [eventId],
      )
      if (rows.length === 0) throw new DynamicEventNotFoundError(eventId)

      await conn.execute<DynamicEventRow[]>(
        'UPDATE atc_dynamic_events SET status = ?, updated_at = NOW(3) WHERE event_id = ?',
        [status, eventId],
      )

      await conn.commit()
      committed = true

      const event = await this.findById(eventId)
      if (!event) throw new DynamicEventNotFoundError(eventId)
      return event
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
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_dynamic_events
         SET status = 'expired', updated_at = NOW(3)
         WHERE status IN ('pending', 'active')
           AND expires_at < NOW(3)`,
        [],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }

  async deleteById(eventId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<DynamicEventRow[]>(
        'DELETE FROM atc_dynamic_events WHERE event_id = ?',
        [eventId],
      )
    } finally {
      conn.release()
    }
  }
}
