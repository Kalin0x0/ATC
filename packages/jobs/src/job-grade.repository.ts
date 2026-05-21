import type { RowDataPacket } from 'mysql2/promise'
import type { AtcJobGrade } from '@atc/shared-types'
import type { JobsPool } from './pool.js'
import { generateId } from './id.js'
import { JobGradeNotFoundError, JobGradeSlugConflictError, JobsValidationError } from './errors.js'

interface JobGradeRow extends RowDataPacket {
  id: string
  job_id: string
  slug: string
  name: string
  level: number
  salary_amount: string
  salary_currency: string
  permissions_json: string | null
  created_at: Date
  updated_at: Date
}

function rowToGrade(row: JobGradeRow): AtcJobGrade {
  return {
    id: row.id,
    jobId: row.job_id,
    slug: row.slug,
    name: row.name,
    level: row.level,
    salaryAmount: parseFloat(row.salary_amount),
    salaryCurrency: row.salary_currency,
    permissions: row.permissions_json ? JSON.parse(row.permissions_json) as string[] : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateJobGradeParams {
  jobId: string
  slug: string
  name: string
  level: number
  salaryAmount: number
  salaryCurrency: string
  permissions?: string[] | undefined
}

export interface UpdateJobGradeParams {
  name?: string | undefined
  level?: number | undefined
  salaryAmount?: number | undefined
  salaryCurrency?: string | undefined
  permissions?: string[] | undefined
}

export class JobGradeRepository {
  constructor(private readonly pool: JobsPool) {}

  async create(params: CreateJobGradeParams): Promise<AtcJobGrade> {
    if (!params.slug || params.slug.length > 64) {
      throw new JobsValidationError('Grade slug must be 1-64 characters')
    }
    if (params.salaryAmount < 0) {
      throw new JobsValidationError('Salary amount must be non-negative')
    }
    if (params.level < 0) {
      throw new JobsValidationError('Grade level must be non-negative')
    }

    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_job_grades
             (id, job_id, slug, name, level, salary_amount, salary_currency, permissions_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
          [
            id, params.jobId, params.slug, params.name, params.level,
            params.salaryAmount.toFixed(4), params.salaryCurrency,
            params.permissions && params.permissions.length > 0
              ? JSON.stringify(params.permissions)
              : null,
          ],
        )
      } catch (err: unknown) {
        if (isDuplicateKeyError(err)) throw new JobGradeSlugConflictError(params.jobId, params.slug)
        throw err
      }
      const grade = await this._findById(conn, id)
      if (!grade) throw new JobGradeNotFoundError(id)
      return grade
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcJobGrade | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async listByJob(jobId: string): Promise<AtcJobGrade[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<JobGradeRow[]>(
        'SELECT * FROM atc_job_grades WHERE job_id = ? ORDER BY level ASC',
        [jobId],
      )
      return rows.map(rowToGrade)
    } finally {
      conn.release()
    }
  }

  async update(id: string, params: UpdateJobGradeParams): Promise<AtcJobGrade> {
    if (params.salaryAmount !== undefined && params.salaryAmount < 0) {
      throw new JobsValidationError('Salary amount must be non-negative')
    }
    const conn = await this.pool.getConnection()
    try {
      const sets: string[] = []
      const vals: (string | number | null)[] = []
      if (params.name !== undefined)          { sets.push('name = ?');            vals.push(params.name) }
      if (params.level !== undefined)         { sets.push('level = ?');           vals.push(params.level) }
      if (params.salaryAmount !== undefined)  { sets.push('salary_amount = ?');   vals.push(params.salaryAmount.toFixed(4)) }
      if (params.salaryCurrency !== undefined){ sets.push('salary_currency = ?'); vals.push(params.salaryCurrency) }
      if (params.permissions !== undefined)   { sets.push('permissions_json = ?'); vals.push(params.permissions.length > 0 ? JSON.stringify(params.permissions) : null) }
      if (sets.length === 0) {
        const grade = await this._findById(conn, id)
        if (!grade) throw new JobGradeNotFoundError(id)
        return grade
      }
      vals.push(id)
      const [result] = await conn.execute<import('mysql2/promise').ResultSetHeader>(
        `UPDATE atc_job_grades SET ${sets.join(', ')}, updated_at = NOW(3) WHERE id = ?`,
        vals,
      )
      if (result.affectedRows === 0) throw new JobGradeNotFoundError(id)
      const grade = await this._findById(conn, id)
      if (!grade) throw new JobGradeNotFoundError(id)
      return grade
    } finally {
      conn.release()
    }
  }

  private async _findById(conn: Awaited<ReturnType<JobsPool['getConnection']>>, id: string): Promise<AtcJobGrade | null> {
    const [rows] = await conn.execute<JobGradeRow[]>('SELECT * FROM atc_job_grades WHERE id = ? LIMIT 1', [id])
    return rows[0] ? rowToGrade(rows[0]) : null
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'ER_DUP_ENTRY'
}
