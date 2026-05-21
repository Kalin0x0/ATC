import type { RowDataPacket } from 'mysql2/promise'
import type { AtcCitation, AtcCitationStatus } from '@atc/shared-types'
import type { LawPool } from './pool.js'
import { generateId } from './id.js'
import { CitationNotFoundError, CitationAlreadyPaidError } from './errors.js'

interface CitationRow extends RowDataPacket {
  id: string
  character_id: string
  issued_by_principal_id: string
  agency_id: string
  reason: string
  amount: string
  currency: string
  status: string
  ledger_journal_id: string | null
  idempotency_key: string
  paid_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToCitation(row: CitationRow): AtcCitation {
  return {
    id: row.id,
    characterId: row.character_id,
    issuedByPrincipalId: row.issued_by_principal_id,
    agencyId: row.agency_id,
    reason: row.reason,
    amount: parseFloat(row.amount),
    currency: row.currency,
    status: row.status as AtcCitationStatus,
    ledgerJournalId: row.ledger_journal_id,
    idempotencyKey: row.idempotency_key,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'ER_DUP_ENTRY'
}

export interface CreateCitationParams {
  characterId: string
  issuedByPrincipalId: string
  agencyId: string
  reason: string
  amount: number
  currency: string
  idempotencyKey: string
}

export interface ListCitationsParams {
  characterId?: string | undefined
  agencyId?: string | undefined
  status?: AtcCitationStatus | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface CitationPage {
  items: AtcCitation[]
  total: number
  offset: number
  limit: number
}

export class CitationRepository {
  constructor(private readonly pool: LawPool) {}

  async create(params: CreateCitationParams): Promise<AtcCitation> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      let replayKey: string | null = null
      try {
        await conn.execute(
          `INSERT INTO atc_citations
             (id, character_id, issued_by_principal_id, agency_id, reason,
              amount, currency, status, idempotency_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, NOW(3), NOW(3))`,
          [
            id, params.characterId, params.issuedByPrincipalId, params.agencyId,
            params.reason, params.amount.toFixed(4), params.currency, params.idempotencyKey,
          ],
        )
      } catch (err: unknown) {
        if (isDuplicateKeyError(err)) {
          replayKey = params.idempotencyKey
        } else {
          throw err
        }
      }

      if (replayKey !== null) {
        const existing = await this.findByIdempotencyKey(replayKey)
        if (!existing) throw new CitationNotFoundError(replayKey)
        return existing
      }

      const citation = await this._findById(conn, id)
      if (!citation) throw new CitationNotFoundError(id)
      return citation
    } finally {
      conn.release()
    }
  }

  async markPaid(id: string, journalId: string, paidAt: Date): Promise<AtcCitation> {
    const conn = await this.pool.getConnection()
    try {
      const citation = await this._findById(conn, id)
      if (!citation) throw new CitationNotFoundError(id)
      if (citation.status === 'paid') throw new CitationAlreadyPaidError(id)

      await conn.execute(
        `UPDATE atc_citations
         SET status = 'paid', ledger_journal_id = ?, paid_at = ?, updated_at = NOW(3)
         WHERE id = ? AND status = 'unpaid'`,
        [journalId, paidAt, id],
      )
      const updated = await this._findById(conn, id)
      if (!updated) throw new CitationNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcCitation | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async findByIdempotencyKey(key: string): Promise<AtcCitation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CitationRow[]>(
        'SELECT * FROM atc_citations WHERE idempotency_key = ? LIMIT 1',
        [key],
      )
      return rows[0] ? rowToCitation(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async list(params: ListCitationsParams = {}): Promise<CitationPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: (string | number | null)[] = []
    if (params.characterId) { conditions.push('character_id = ?'); args.push(params.characterId) }
    if (params.agencyId)    { conditions.push('agency_id = ?');    args.push(params.agencyId) }
    if (params.status)      { conditions.push('status = ?');       args.push(params.status) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_citations ${where}`, args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<CitationRow[]>(
        `SELECT * FROM atc_citations ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToCitation), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  private async _findById(conn: Awaited<ReturnType<LawPool['getConnection']>>, id: string): Promise<AtcCitation | null> {
    const [rows] = await conn.execute<CitationRow[]>('SELECT * FROM atc_citations WHERE id = ? LIMIT 1', [id])
    return rows[0] ? rowToCitation(rows[0]) : null
  }
}
