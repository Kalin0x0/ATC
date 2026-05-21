import type { RowDataPacket } from 'mysql2/promise'
import type { AtcAgency, AtcAgencyType, AtcAgencyStatus } from '@atc/shared-types'
import type { LawPool } from './pool.js'
import { generateId } from './id.js'
import { AgencyNotFoundError, AgencySlugConflictError, LawValidationError } from './errors.js'

interface AgencyRow extends RowDataPacket {
  id: string
  slug: string
  name: string
  type: string
  status: string
  organization_id: string | null
  description: string | null
  created_at: Date
  updated_at: Date
}

function rowToAgency(row: AgencyRow): AtcAgency {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type as AtcAgencyType,
    status: row.status as AtcAgencyStatus,
    organizationId: row.organization_id,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'ER_DUP_ENTRY'
}

export interface CreateAgencyParams {
  slug: string
  name: string
  type: AtcAgencyType
  organizationId?: string | null | undefined
  description?: string | null | undefined
}

export interface ListAgenciesParams {
  type?: AtcAgencyType | undefined
  status?: AtcAgencyStatus | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface AgencyPage {
  items: AtcAgency[]
  total: number
  offset: number
  limit: number
}

export class AgencyRepository {
  constructor(private readonly pool: LawPool) {}

  async create(params: CreateAgencyParams): Promise<AtcAgency> {
    if (!params.slug || params.slug.length > 64) {
      throw new LawValidationError('Agency slug must be 1-64 characters')
    }
    if (!params.name || params.name.length > 256) {
      throw new LawValidationError('Agency name must be 1-256 characters')
    }

    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_agencies (id, slug, name, type, status, organization_id, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'active', ?, ?, NOW(3), NOW(3))`,
          [id, params.slug, params.name, params.type, params.organizationId ?? null, params.description ?? null],
        )
      } catch (err: unknown) {
        if (isDuplicateKeyError(err)) throw new AgencySlugConflictError(params.slug)
        throw err
      }
      const agency = await this._findById(conn, id)
      if (!agency) throw new AgencyNotFoundError(id)
      return agency
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcAgency | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async findBySlug(slug: string): Promise<AtcAgency | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AgencyRow[]>(
        'SELECT * FROM atc_agencies WHERE slug = ? LIMIT 1',
        [slug],
      )
      return rows[0] ? rowToAgency(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async list(params: ListAgenciesParams = {}): Promise<AgencyPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: (string | number | null)[] = []
    if (params.type)   { conditions.push('type = ?');   args.push(params.type) }
    if (params.status) { conditions.push('status = ?'); args.push(params.status) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_agencies ${where}`, args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<AgencyRow[]>(
        `SELECT * FROM atc_agencies ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToAgency), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  async deactivate(id: string): Promise<AtcAgency> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<import('mysql2/promise').ResultSetHeader>(
        `UPDATE atc_agencies SET status = 'inactive', updated_at = NOW(3) WHERE id = ?`,
        [id],
      )
      if (result.affectedRows === 0) throw new AgencyNotFoundError(id)
      const agency = await this._findById(conn, id)
      if (!agency) throw new AgencyNotFoundError(id)
      return agency
    } finally {
      conn.release()
    }
  }

  private async _findById(conn: Awaited<ReturnType<LawPool['getConnection']>>, id: string): Promise<AtcAgency | null> {
    const [rows] = await conn.execute<AgencyRow[]>('SELECT * FROM atc_agencies WHERE id = ? LIMIT 1', [id])
    return rows[0] ? rowToAgency(rows[0]) : null
  }
}
