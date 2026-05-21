import type { RowDataPacket } from 'mysql2/promise'
import type { DisasterRuntimePool } from './pool.js'
import { generateId } from './id.js'
import {
  DisasterEventNotFoundError,
  DuplicateDisasterNonceError,
} from './errors.js'

export type AtcDisasterType =
  | 'earthquake'
  | 'flood'
  | 'fire'
  | 'chemical'
  | 'nuclear'
  | 'storm'
  | 'blackout'
  | 'pandemic'
  | 'riot'
  | 'custom'

export type AtcDisasterStatus = 'active' | 'contained' | 'resolved' | 'escalated'

export interface AtcDisasterEvent {
  id: string
  disasterId: string
  disasterNonce: string
  disasterType: AtcDisasterType
  disasterName: string
  severity: number
  status: AtcDisasterStatus
  affectedZoneIds: string[]
  initiatedByPrincipalId: string | null
  ownerServerId: string | null
  containedAt: Date | null
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface DisasterEventRow extends RowDataPacket {
  id: string
  disaster_id: string
  disaster_nonce: string
  disaster_type: string
  disaster_name: string
  severity: number
  status: string
  affected_zone_ids: string
  initiated_by_principal_id: string | null
  owner_server_id: string | null
  contained_at: Date | null
  resolved_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToDisasterEvent(row: DisasterEventRow): AtcDisasterEvent {
  let affectedZoneIds: string[] = []
  try {
    const parsed: unknown = typeof row.affected_zone_ids === 'string'
      ? JSON.parse(row.affected_zone_ids)
      : row.affected_zone_ids
    if (Array.isArray(parsed)) {
      affectedZoneIds = parsed as string[]
    }
  } catch {
    affectedZoneIds = []
  }
  return {
    id: row.id,
    disasterId: row.disaster_id,
    disasterNonce: row.disaster_nonce,
    disasterType: row.disaster_type as AtcDisasterType,
    disasterName: row.disaster_name,
    severity: Number(row.severity),
    status: row.status as AtcDisasterStatus,
    affectedZoneIds,
    initiatedByPrincipalId: row.initiated_by_principal_id,
    ownerServerId: row.owner_server_id,
    containedAt: row.contained_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateDisasterEventParams {
  disasterNonce: string
  disasterType: AtcDisasterType
  disasterName: string
  severity: number
  affectedZoneIds?: string[] | undefined
  initiatedByPrincipalId?: string | undefined
  ownerServerId?: string | undefined
}

export class DisasterEventRepository {
  constructor(private readonly pool: DisasterRuntimePool) {}

  async findById(disasterId: string): Promise<AtcDisasterEvent | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DisasterEventRow[]>(
        `SELECT * FROM atc_disaster_events WHERE disaster_id = ? LIMIT 1`,
        [disasterId],
      )
      return rows[0] ? rowToDisasterEvent(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcDisasterEvent[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DisasterEventRow[]>(
        `SELECT * FROM atc_disaster_events
         WHERE status IN ('active', 'escalated')
         ORDER BY created_at DESC`,
      )
      return rows.map(rowToDisasterEvent)
    } finally {
      conn.release()
    }
  }

  async create(params: CreateDisasterEventParams): Promise<AtcDisasterEvent> {
    const id = generateId()
    const disasterId = generateId()
    const affectedZoneIds = JSON.stringify(params.affectedZoneIds ?? [])
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_disaster_events
             (id, disaster_id, disaster_nonce, disaster_type, disaster_name, severity, status,
              affected_zone_ids, initiated_by_principal_id, owner_server_id,
              contained_at, resolved_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, NULL, NULL, NOW(3), NOW(3))`,
          [
            id,
            disasterId,
            params.disasterNonce,
            params.disasterType,
            params.disasterName,
            params.severity,
            affectedZoneIds,
            params.initiatedByPrincipalId ?? null,
            params.ownerServerId ?? null,
          ] as (string | number | boolean | null)[],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateDisasterNonceError(params.disasterNonce)
        }
        throw err
      }
      const [rows] = await conn.execute<DisasterEventRow[]>(
        `SELECT * FROM atc_disaster_events WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new DisasterEventNotFoundError(disasterId)
      return rowToDisasterEvent(rows[0])
    } finally {
      conn.release()
    }
  }

  async transition(disasterId: string, status: AtcDisasterStatus): Promise<AtcDisasterEvent> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<DisasterEventRow[]>(
          `SELECT * FROM atc_disaster_events WHERE disaster_id = ? LIMIT 1 FOR UPDATE`,
          [disasterId],
        )
        if (!rows[0]) {
          await conn.rollback()
          throw new DisasterEventNotFoundError(disasterId)
        }

        const containedAtClause = status === 'contained' ? ', contained_at = NOW(3)' : ''
        const resolvedAtClause = status === 'resolved' ? ', resolved_at = NOW(3)' : ''

        await conn.execute(
          `UPDATE atc_disaster_events
           SET status = ? ${containedAtClause}${resolvedAtClause}, updated_at = NOW(3)
           WHERE disaster_id = ?`,
          [status, disasterId] as (string | number | boolean | null)[],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [updated] = await conn.execute<DisasterEventRow[]>(
        `SELECT * FROM atc_disaster_events WHERE disaster_id = ? LIMIT 1`,
        [disasterId],
      )
      if (!updated[0]) throw new DisasterEventNotFoundError(disasterId)
      return rowToDisasterEvent(updated[0])
    } finally {
      conn.release()
    }
  }

  async listStale(thresholdMs: number): Promise<AtcDisasterEvent[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DisasterEventRow[]>(
        `SELECT * FROM atc_disaster_events
         WHERE status IN ('active', 'escalated')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)
         ORDER BY updated_at ASC`,
        [thresholdMs] as (string | number | boolean | null)[],
      )
      return rows.map(rowToDisasterEvent)
    } finally {
      conn.release()
    }
  }
}
