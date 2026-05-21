import type { RowDataPacket } from 'mysql2/promise'
import type {
  AtcDispatchCall,
  AtcDispatchPriority,
  AtcDispatchSource,
} from '@atc/shared-types'
import type { DispatchPool } from './pool.js'
import { generateId } from './id.js'
import { DispatchCallNotFoundError, DispatchCallImmutableError } from './errors.js'

interface DispatchCallRow extends RowDataPacket {
  id: string
  source: string
  caller_identifier: string | null
  location: string
  priority: string
  description: string
  incident_id: string | null
  idempotency_key: string
  created_at: Date
  accepted_at: Date | null
  closed_at: Date | null
}

function rowToCall(row: DispatchCallRow): AtcDispatchCall {
  return {
    id: row.id,
    source: row.source as AtcDispatchSource,
    callerIdentifier: row.caller_identifier,
    location: row.location,
    priority: row.priority as AtcDispatchPriority,
    description: row.description,
    incidentId: row.incident_id,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    closedAt: row.closed_at,
  }
}

export interface CreateDispatchCallParams {
  source: AtcDispatchSource
  callerIdentifier?: string | null | undefined
  location: string
  priority: AtcDispatchPriority
  description: string
  idempotencyKey: string
}

export interface ListDispatchCallsParams {
  source?: AtcDispatchSource | undefined
  priority?: AtcDispatchPriority | undefined
  openOnly?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface DispatchCallPage {
  items: AtcDispatchCall[]
  total: number
  offset: number
  limit: number
}

export class DispatchCallRepository {
  constructor(private readonly pool: DispatchPool) {}

  async create(params: CreateDispatchCallParams): Promise<AtcDispatchCall> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_dispatch_calls
             (id, source, caller_identifier, location, priority, description, idempotency_key, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`,
          [id, params.source, params.callerIdentifier ?? null, params.location, params.priority, params.description, params.idempotencyKey],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          return this.findByIdempotencyKey(params.idempotencyKey) as Promise<AtcDispatchCall>
        }
        throw err
      }
      const call = await this._findById(conn, id)
      if (!call) throw new DispatchCallNotFoundError(id)
      return call
    } finally {
      conn.release()
    }
  }

  async accept(id: string, incidentId: string): Promise<AtcDispatchCall> {
    const conn = await this.pool.getConnection()
    try {
      const call = await this._findById(conn, id)
      if (!call) throw new DispatchCallNotFoundError(id)
      if (call.closedAt) throw new DispatchCallImmutableError(id, 'already closed')

      await conn.execute(
        `UPDATE atc_dispatch_calls SET accepted_at = NOW(3), incident_id = ?, updated_at = NOW(3) WHERE id = ?`,
        [incidentId, id],
      )
      const updated = await this._findById(conn, id)
      if (!updated) throw new DispatchCallNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async close(id: string): Promise<AtcDispatchCall> {
    const conn = await this.pool.getConnection()
    try {
      const call = await this._findById(conn, id)
      if (!call) throw new DispatchCallNotFoundError(id)
      if (call.closedAt) throw new DispatchCallImmutableError(id, 'already closed')

      await conn.execute(
        `UPDATE atc_dispatch_calls SET closed_at = NOW(3) WHERE id = ?`,
        [id],
      )
      const updated = await this._findById(conn, id)
      if (!updated) throw new DispatchCallNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcDispatchCall | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async findByIdempotencyKey(key: string): Promise<AtcDispatchCall | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DispatchCallRow[]>(
        `SELECT * FROM atc_dispatch_calls WHERE idempotency_key = ? LIMIT 1`,
        [key],
      )
      return rows[0] ? rowToCall(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async list(params: ListDispatchCallsParams = {}): Promise<DispatchCallPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: (string | number | null)[] = []
    if (params.source)           { conditions.push('source = ?');      args.push(params.source) }
    if (params.priority)         { conditions.push('priority = ?');    args.push(params.priority) }
    if (params.openOnly === true) { conditions.push('closed_at IS NULL') }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_dispatch_calls ${where}`, args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<DispatchCallRow[]>(
        `SELECT * FROM atc_dispatch_calls ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToCall), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  private async _findById(conn: Awaited<ReturnType<DispatchPool['getConnection']>>, id: string): Promise<AtcDispatchCall | null> {
    const [rows] = await conn.execute<DispatchCallRow[]>(
      `SELECT * FROM atc_dispatch_calls WHERE id = ? LIMIT 1`, [id],
    )
    return rows[0] ? rowToCall(rows[0]) : null
  }
}
