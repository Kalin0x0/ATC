import type { RowDataPacket } from 'mysql2/promise'
import type { AtcPrincipalType, SecurityEventRecord } from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import { generateId } from './id.js'
import type { PrincipalStorePool } from './pool.js'

interface SecurityEventRow extends RowDataPacket {
  id: string
  actor_id: string
  actor_type: string
  action: string
  target: string | null
  result: string
  source_instance_id: string | null
  event_metadata: string | null
  created_at: Date
}

function rowToRecord(row: SecurityEventRow): SecurityEventRecord {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorType: row.actor_type as AtcPrincipalType,
    action: row.action,
    target: row.target,
    result: row.result as SecurityEventRecord['result'],
    sourceInstanceId: row.source_instance_id,
    metadata: row.event_metadata ? JSON.parse(row.event_metadata) as Record<string, unknown> : null,
    createdAt: row.created_at,
  }
}

export interface AppendSecurityEventParams {
  actorId: string
  actorType: AtcPrincipalType
  action: string
  target?: string
  result: 'granted' | 'denied' | 'error'
  sourceInstanceId?: string
  metadata?: Record<string, unknown>
}

export interface ListSecurityEventsParams {
  limit?: number
  offset?: number
  actorId?: string
  action?: string
  result?: 'granted' | 'denied' | 'error'
}

export interface SecurityEventPage {
  events: SecurityEventRecord[]
  total: number
  offset: number
  limit: number
}

export class SecurityEventRepository {
  constructor(
    private readonly pool: PrincipalStorePool,
    private readonly telemetry?: AtcTelemetryService,
  ) {}

  async append(params: AppendSecurityEventParams): Promise<SecurityEventRecord> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute(
        `INSERT INTO atc_security_events
           (id, actor_id, actor_type, action, target, result, source_instance_id, event_metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.actorId,
          params.actorType,
          params.action,
          params.target ?? null,
          params.result,
          params.sourceInstanceId ?? null,
          params.metadata ? JSON.stringify(params.metadata) : null,
        ],
      )
      this.telemetry?.increment('security.audit_events_total')
      const [rows] = await conn.execute<SecurityEventRow[]>(
        'SELECT * FROM atc_security_events WHERE id = ? LIMIT 1',
        [id],
      )
      const row = rows[0]
      if (!row) throw new Error(`Security event not found after insert: ${id}`)
      return rowToRecord(row)
    } finally {
      conn.release()
    }
  }

  async list(params: ListSecurityEventsParams = {}): Promise<SecurityEventPage> {
    const limit = Math.min(params.limit ?? 50, 200)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const filterArgs: string[] = []

    if (params.actorId) { conditions.push('actor_id = ?'); filterArgs.push(params.actorId) }
    if (params.action) { conditions.push('action = ?'); filterArgs.push(params.action) }
    if (params.result) { conditions.push('result = ?'); filterArgs.push(params.result) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_security_events ${where}`,
        filterArgs,
      )
      const total = countRows[0]?.total ?? 0

      const [rows] = await conn.execute<SecurityEventRow[]>(
        `SELECT * FROM atc_security_events ${where}
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...filterArgs, limit, offset],
      )

      return { events: rows.map(rowToRecord), total, offset, limit }
    } finally {
      conn.release()
    }
  }
}
