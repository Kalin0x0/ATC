import type { RowDataPacket } from 'mysql2/promise'
import type { AtcJob, AtcJobPage, JobType, JobStatus } from '@atc/shared-types'
import type { JobsPool } from './pool.js'
import { generateId } from './id.js'
import { JobNotFoundError, JobSlugConflictError, JobsValidationError } from './errors.js'

interface JobRow extends RowDataPacket {
  id: string
  slug: string
  name: string
  type: string
  status: string
  organization_id: string | null
  salary_account_id: string | null
  metadata_json: string | null
  created_at: Date
  updated_at: Date
}

function rowToJob(row: JobRow): AtcJob {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type as JobType,
    status: row.status as JobStatus,
    organizationId: row.organization_id,
    salaryAccountId: row.salary_account_id,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) as Record<string, unknown> : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateJobParams {
  slug: string
  name: string
  type: JobType
  organizationId?: string | null | undefined
  salaryAccountId?: string | null | undefined
  metadata?: Record<string, unknown> | null | undefined
}

export interface UpdateJobParams {
  name?: string | undefined
  status?: JobStatus | undefined
  salaryAccountId?: string | null | undefined
  metadata?: Record<string, unknown> | null | undefined
}

export interface ListJobsParams {
  type?: JobType | undefined
  status?: JobStatus | undefined
  organizationId?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export class JobRepository {
  constructor(private readonly pool: JobsPool) {}

  async create(params: CreateJobParams): Promise<AtcJob> {
    if (!params.slug || params.slug.length > 64) {
      throw new JobsValidationError('Job slug must be 1-64 characters')
    }
    if (!params.name || params.name.length > 256) {
      throw new JobsValidationError('Job name must be 1-256 characters')
    }

    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_jobs (id, slug, name, type, status, organization_id, salary_account_id, metadata_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'active', ?, ?, ?, NOW(3), NOW(3))`,
          [
            id, params.slug, params.name, params.type,
            params.organizationId ?? null,
            params.salaryAccountId ?? null,
            params.metadata ? JSON.stringify(params.metadata) : null,
          ],
        )
      } catch (err: unknown) {
        if (isDuplicateKeyError(err)) throw new JobSlugConflictError(params.slug)
        throw err
      }
      const job = await this._findById(conn, id)
      if (!job) throw new JobNotFoundError(id)
      return job
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcJob | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async findBySlug(slug: string): Promise<AtcJob | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<JobRow[]>(
        'SELECT * FROM atc_jobs WHERE slug = ? LIMIT 1',
        [slug],
      )
      return rows[0] ? rowToJob(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async update(id: string, params: UpdateJobParams): Promise<AtcJob> {
    const conn = await this.pool.getConnection()
    try {
      const sets: string[] = []
      const vals: (string | number | null)[] = []
      if (params.name !== undefined)           { sets.push('name = ?');               vals.push(params.name) }
      if (params.status !== undefined)         { sets.push('status = ?');             vals.push(params.status) }
      if (params.salaryAccountId !== undefined) { sets.push('salary_account_id = ?'); vals.push(params.salaryAccountId) }
      if (params.metadata !== undefined)       { sets.push('metadata_json = ?');      vals.push(params.metadata ? JSON.stringify(params.metadata) : null) }
      if (sets.length === 0) {
        const job = await this._findById(conn, id)
        if (!job) throw new JobNotFoundError(id)
        return job
      }
      vals.push(id)
      const [result] = await conn.execute<import('mysql2/promise').ResultSetHeader>(
        `UPDATE atc_jobs SET ${sets.join(', ')}, updated_at = NOW(3) WHERE id = ?`,
        vals,
      )
      if (result.affectedRows === 0) throw new JobNotFoundError(id)
      const job = await this._findById(conn, id)
      if (!job) throw new JobNotFoundError(id)
      return job
    } finally {
      conn.release()
    }
  }

  async list(params: ListJobsParams = {}): Promise<AtcJobPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: (string | number | null)[] = []
    if (params.type)           { conditions.push('type = ?');           args.push(params.type) }
    if (params.status)         { conditions.push('status = ?');         args.push(params.status) }
    if (params.organizationId) { conditions.push('organization_id = ?'); args.push(params.organizationId) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_jobs ${where}`, args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<JobRow[]>(
        `SELECT * FROM atc_jobs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToJob), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  private async _findById(conn: Awaited<ReturnType<JobsPool['getConnection']>>, id: string): Promise<AtcJob | null> {
    const [rows] = await conn.execute<JobRow[]>('SELECT * FROM atc_jobs WHERE id = ? LIMIT 1', [id])
    return rows[0] ? rowToJob(rows[0]) : null
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'ER_DUP_ENTRY'
}
