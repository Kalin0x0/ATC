import type { RowDataPacket } from 'mysql2/promise'
import type { AtcLegalCase, AtcLegalCaseStatus } from '@atc/shared-types'
import type { LawPool } from './pool.js'
import { generateId } from './id.js'
import { LegalCaseNotFoundError, LawValidationError } from './errors.js'

interface LegalCaseRow extends RowDataPacket {
  id: string
  title: string
  status: string
  agency_id: string
  created_by_principal_id: string
  notes: string | null
  created_at: Date
  updated_at: Date
}

function rowToCase(row: LegalCaseRow): AtcLegalCase {
  return {
    id: row.id,
    title: row.title,
    status: row.status as AtcLegalCaseStatus,
    agencyId: row.agency_id,
    createdByPrincipalId: row.created_by_principal_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateLegalCaseParams {
  title: string
  agencyId: string
  createdByPrincipalId: string
  notes?: string | null | undefined
}

export interface ListLegalCasesParams {
  agencyId?: string | undefined
  status?: AtcLegalCaseStatus | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface LegalCasePage {
  items: AtcLegalCase[]
  total: number
  offset: number
  limit: number
}

export class LegalCaseRepository {
  constructor(private readonly pool: LawPool) {}

  async create(params: CreateLegalCaseParams): Promise<AtcLegalCase> {
    if (!params.title || params.title.length > 512) {
      throw new LawValidationError('Case title must be 1-512 characters')
    }
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_legal_cases
           (id, title, status, agency_id, created_by_principal_id, notes, created_at, updated_at)
         VALUES (?, ?, 'open', ?, ?, ?, NOW(3), NOW(3))`,
        [id, params.title, params.agencyId, params.createdByPrincipalId, params.notes ?? null],
      )
      const legalCase = await this._findById(conn, id)
      if (!legalCase) throw new LegalCaseNotFoundError(id)
      return legalCase
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcLegalCase | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async close(id: string): Promise<AtcLegalCase> {
    return this._transition(id, 'closed', ['open'])
  }

  async archive(id: string): Promise<AtcLegalCase> {
    return this._transition(id, 'archived', ['open', 'closed'])
  }

  async list(params: ListLegalCasesParams = {}): Promise<LegalCasePage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: (string | number | null)[] = []
    if (params.agencyId) { conditions.push('agency_id = ?'); args.push(params.agencyId) }
    if (params.status)   { conditions.push('status = ?');    args.push(params.status) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_legal_cases ${where}`, args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<LegalCaseRow[]>(
        `SELECT * FROM atc_legal_cases ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToCase), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  private async _transition(id: string, toStatus: AtcLegalCaseStatus, fromStatuses: AtcLegalCaseStatus[]): Promise<AtcLegalCase> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      const [rows] = await conn.execute<LegalCaseRow[]>(
        'SELECT * FROM atc_legal_cases WHERE id = ? LIMIT 1 FOR UPDATE',
        [id],
      )
      const row = rows[0]
      if (!row) { await conn.rollback(); throw new LegalCaseNotFoundError(id) }
      if (!fromStatuses.includes(row.status as AtcLegalCaseStatus)) {
        await conn.rollback()
        throw new LawValidationError(`Case ${id} cannot transition to '${toStatus}' from status '${row.status}'`)
      }
      await conn.execute(
        `UPDATE atc_legal_cases SET status = ?, updated_at = NOW(3) WHERE id = ?`,
        [toStatus, id],
      )
      await conn.commit()
      const updated = await this._findById(conn, id)
      if (!updated) throw new LegalCaseNotFoundError(id)
      return updated
    } catch (err) {
      try { await conn.rollback() } catch { /* best-effort */ }
      throw err
    } finally {
      conn.release()
    }
  }

  private async _findById(conn: Awaited<ReturnType<LawPool['getConnection']>>, id: string): Promise<AtcLegalCase | null> {
    const [rows] = await conn.execute<LegalCaseRow[]>('SELECT * FROM atc_legal_cases WHERE id = ? LIMIT 1', [id])
    return rows[0] ? rowToCase(rows[0]) : null
  }
}
