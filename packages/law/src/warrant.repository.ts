import type { RowDataPacket } from 'mysql2/promise'
import type { AtcWarrant, AtcLawSeverity, AtcWarrantStatus } from '@atc/shared-types'
import type { LawPool } from './pool.js'
import { generateId } from './id.js'
import { WarrantNotFoundError, WarrantImmutableError } from './errors.js'

interface WarrantRow extends RowDataPacket {
  id: string
  character_id: string
  issued_by_principal_id: string
  agency_id: string
  severity: string
  status: string
  reason: string
  expires_at: Date | null
  executed_at: Date | null
  revoked_at: Date | null
  revoke_reason: string | null
  created_at: Date
  updated_at: Date
}

function rowToWarrant(row: WarrantRow): AtcWarrant {
  return {
    id: row.id,
    characterId: row.character_id,
    issuedByPrincipalId: row.issued_by_principal_id,
    agencyId: row.agency_id,
    severity: row.severity as AtcLawSeverity,
    status: row.status as AtcWarrantStatus,
    reason: row.reason,
    expiresAt: row.expires_at,
    executedAt: row.executed_at,
    revokedAt: row.revoked_at,
    revokeReason: row.revoke_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateWarrantParams {
  characterId: string
  issuedByPrincipalId: string
  agencyId: string
  severity: AtcLawSeverity
  reason: string
  expiresAt?: Date | null | undefined
}

export interface ListWarrantsParams {
  characterId?: string | undefined
  agencyId?: string | undefined
  status?: AtcWarrantStatus | undefined
  severity?: AtcLawSeverity | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface WarrantPage {
  items: AtcWarrant[]
  total: number
  offset: number
  limit: number
}

export class WarrantRepository {
  constructor(private readonly pool: LawPool) {}

  async create(params: CreateWarrantParams): Promise<AtcWarrant> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_warrants
           (id, character_id, issued_by_principal_id, agency_id, severity, status, reason, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, NOW(3), NOW(3))`,
        [id, params.characterId, params.issuedByPrincipalId, params.agencyId, params.severity, params.reason, params.expiresAt ?? null],
      )
      const warrant = await this._findById(conn, id)
      if (!warrant) throw new WarrantNotFoundError(id)
      return warrant
    } finally {
      conn.release()
    }
  }

  async executeWarrant(id: string): Promise<AtcWarrant> {
    const conn = await this.pool.getConnection()
    try {
      const warrant = await this._findById(conn, id)
      if (!warrant) throw new WarrantNotFoundError(id)
      if (warrant.status !== 'active') throw new WarrantImmutableError(id, warrant.status)

      await conn.execute(
        `UPDATE atc_warrants SET status = 'executed', executed_at = NOW(3), updated_at = NOW(3) WHERE id = ?`,
        [id],
      )
      const updated = await this._findById(conn, id)
      if (!updated) throw new WarrantNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async expireWarrant(id: string): Promise<AtcWarrant> {
    const conn = await this.pool.getConnection()
    try {
      const warrant = await this._findById(conn, id)
      if (!warrant) throw new WarrantNotFoundError(id)
      if (warrant.status !== 'active') throw new WarrantImmutableError(id, warrant.status)

      await conn.execute(
        `UPDATE atc_warrants SET status = 'expired', updated_at = NOW(3) WHERE id = ?`,
        [id],
      )
      const updated = await this._findById(conn, id)
      if (!updated) throw new WarrantNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async revokeWarrant(id: string, reason: string): Promise<AtcWarrant> {
    const conn = await this.pool.getConnection()
    try {
      const warrant = await this._findById(conn, id)
      if (!warrant) throw new WarrantNotFoundError(id)
      if (warrant.status !== 'active') throw new WarrantImmutableError(id, warrant.status)

      await conn.execute(
        `UPDATE atc_warrants SET status = 'revoked', revoked_at = NOW(3), revoke_reason = ?, updated_at = NOW(3) WHERE id = ?`,
        [reason, id],
      )
      const updated = await this._findById(conn, id)
      if (!updated) throw new WarrantNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcWarrant | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async listByCharacter(characterId: string): Promise<AtcWarrant[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<WarrantRow[]>(
        `SELECT * FROM atc_warrants WHERE character_id = ? ORDER BY created_at DESC`,
        [characterId],
      )
      return rows.map(rowToWarrant)
    } finally {
      conn.release()
    }
  }

  async list(params: ListWarrantsParams = {}): Promise<WarrantPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: (string | number | null)[] = []
    if (params.characterId) { conditions.push('character_id = ?'); args.push(params.characterId) }
    if (params.agencyId)    { conditions.push('agency_id = ?');    args.push(params.agencyId) }
    if (params.status)      { conditions.push('status = ?');       args.push(params.status) }
    if (params.severity)    { conditions.push('severity = ?');     args.push(params.severity) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_warrants ${where}`, args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<WarrantRow[]>(
        `SELECT * FROM atc_warrants ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToWarrant), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  private async _findById(conn: Awaited<ReturnType<LawPool['getConnection']>>, id: string): Promise<AtcWarrant | null> {
    const [rows] = await conn.execute<WarrantRow[]>('SELECT * FROM atc_warrants WHERE id = ? LIMIT 1', [id])
    return rows[0] ? rowToWarrant(rows[0]) : null
  }
}
