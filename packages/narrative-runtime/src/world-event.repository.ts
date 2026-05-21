import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { NarrativeRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { WorldEventNotFoundError } from './errors.js'

export type AtcWorldEventType = 'weather' | 'political' | 'economic' | 'conflict' | 'disaster' | 'social' | 'custom'
export type AtcWorldEventStatus = 'pending' | 'active' | 'completed' | 'expired' | 'cancelled'

export interface AtcWorldEvent {
  id: string
  eventId: string
  eventType: AtcWorldEventType
  status: AtcWorldEventStatus
  ownerServerId: string
  regionId: string | null
  triggerCondition: string
  eventData: Record<string, unknown>
  startedAt: Date
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface WorldEventRow extends RowDataPacket {
  id: string
  event_id: string
  event_type: string
  status: string
  owner_server_id: string
  region_id: string | null
  trigger_condition: string
  event_data: string
  started_at: Date
  expires_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToWorldEvent(row: WorldEventRow): AtcWorldEvent {
  return {
    id: row.id,
    eventId: row.event_id,
    eventType: row.event_type as AtcWorldEventType,
    status: row.status as AtcWorldEventStatus,
    ownerServerId: row.owner_server_id,
    regionId: row.region_id,
    triggerCondition: row.trigger_condition,
    eventData: JSON.parse(row.event_data) as Record<string, unknown>,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateWorldEventParams {
  eventId: string
  eventType: AtcWorldEventType
  ownerServerId: string
  regionId?: string | null | undefined
  triggerCondition?: string | undefined
  eventData?: Record<string, unknown> | undefined
  expiresAt?: Date | null | undefined
}

export class WorldEventRepository {
  constructor(private readonly pool: NarrativeRuntimePool) {}

  async create(params: CreateWorldEventParams): Promise<AtcWorldEvent> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_world_events
             (id, event_id, event_type, status, owner_server_id, region_id,
              trigger_condition, event_data, started_at, expires_at, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?, ?, ?, NOW(3), ?, NOW(3), NOW(3))`,
          [
            id,
            params.eventId,
            params.eventType,
            params.ownerServerId,
            params.regionId ?? null,
            params.triggerCondition ?? '',
            JSON.stringify(params.eventData ?? {}),
            params.expiresAt ?? null,
          ],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new WorldEventNotFoundError(params.eventId)
        }
        throw err
      }
      const [rows] = await conn.execute<WorldEventRow[]>(
        `SELECT * FROM atc_world_events WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new WorldEventNotFoundError(id)
      return rowToWorldEvent(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcWorldEvent | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<WorldEventRow[]>(
        `SELECT * FROM atc_world_events WHERE id = ? LIMIT 1`,
        [id],
      )
      return rows[0] ? rowToWorldEvent(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByEventId(eventId: string): Promise<AtcWorldEvent | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<WorldEventRow[]>(
        `SELECT * FROM atc_world_events WHERE event_id = ? LIMIT 1`,
        [eventId],
      )
      return rows[0] ? rowToWorldEvent(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcWorldEventStatus): Promise<AtcWorldEvent> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<WorldEventRow[]>(
          `SELECT * FROM atc_world_events WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        if (!rows[0]) throw new WorldEventNotFoundError(id)
        await conn.execute(
          `UPDATE atc_world_events
           SET status = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [status, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [rows] = await conn.execute<WorldEventRow[]>(
        `SELECT * FROM atc_world_events WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new WorldEventNotFoundError(id)
      return rowToWorldEvent(rows[0])
    } finally {
      conn.release()
    }
  }

  async listActive(ownerServerId?: string | undefined): Promise<AtcWorldEvent[]> {
    const conn = await this.pool.getConnection()
    try {
      if (ownerServerId !== undefined) {
        const [rows] = await conn.execute<WorldEventRow[]>(
          `SELECT * FROM atc_world_events
           WHERE status = 'active' AND owner_server_id = ?
           ORDER BY started_at DESC`,
          [ownerServerId],
        )
        return rows.map(rowToWorldEvent)
      }
      const [rows] = await conn.execute<WorldEventRow[]>(
        `SELECT * FROM atc_world_events
         WHERE status = 'active'
         ORDER BY started_at DESC`,
      )
      return rows.map(rowToWorldEvent)
    } finally {
      conn.release()
    }
  }

  async cleanupExpired(): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_world_events
         WHERE expires_at < NOW()`,
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
