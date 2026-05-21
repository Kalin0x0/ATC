import type { RowDataPacket } from 'mysql2/promise'
import type { CraftingRuntimePool } from './pool.js'
import { generateId } from './id.js'
import {
  ProductionJobNotFoundError,
  DuplicateJobNonceError,
} from './errors.js'

export type AtcProductionStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

export interface AtcProductionJob {
  id: string
  jobId: string
  queueId: string
  recipeId: string
  initiatedByPrincipalId: string
  status: AtcProductionStatus
  quantityOrdered: number
  quantityProduced: number
  jobNonce: string
  startedAt: Date | null
  completedAt: Date | null
  failedReason: string | null
  createdAt: Date
  updatedAt: Date
}

interface ProductionJobRow extends RowDataPacket {
  id: string
  job_id: string
  queue_id: string
  recipe_id: string
  initiated_by_principal_id: string
  status: string
  quantity_ordered: number
  quantity_produced: number
  job_nonce: string
  started_at: Date | null
  completed_at: Date | null
  failed_reason: string | null
  created_at: Date
  updated_at: Date
}

function rowToJob(row: ProductionJobRow): AtcProductionJob {
  return {
    id: row.id,
    jobId: row.job_id,
    queueId: row.queue_id,
    recipeId: row.recipe_id,
    initiatedByPrincipalId: row.initiated_by_principal_id,
    status: row.status as AtcProductionStatus,
    quantityOrdered: Number(row.quantity_ordered),
    quantityProduced: Number(row.quantity_produced),
    jobNonce: row.job_nonce,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failedReason: row.failed_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ProductionJobRepository {
  constructor(private readonly pool: CraftingRuntimePool) {}

  async findById(jobId: string): Promise<AtcProductionJob | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ProductionJobRow[]>(
        'SELECT * FROM atc_production_jobs WHERE job_id = ? LIMIT 1',
        [jobId],
      )
      return rows[0] ? rowToJob(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByNonce(nonce: string): Promise<AtcProductionJob | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ProductionJobRow[]>(
        'SELECT * FROM atc_production_jobs WHERE job_nonce = ? LIMIT 1',
        [nonce],
      )
      return rows[0] ? rowToJob(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findActiveByQueue(queueId: string): Promise<AtcProductionJob | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ProductionJobRow[]>(
        `SELECT * FROM atc_production_jobs
         WHERE queue_id = ? AND status IN ('pending', 'in_progress')
         LIMIT 1`,
        [queueId],
      )
      return rows[0] ? rowToJob(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async create(params: {
    queueId: string
    recipeId: string
    initiatedByPrincipalId: string
    quantityOrdered: number
    jobNonce: string
  }): Promise<AtcProductionJob> {
    const id = generateId()
    const jobId = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_production_jobs
             (id, job_id, queue_id, recipe_id, initiated_by_principal_id, status,
              quantity_ordered, quantity_produced, job_nonce,
              started_at, completed_at, failed_reason, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, 0, ?, NULL, NULL, NULL, NOW(3), NOW(3))`,
          [
            id,
            jobId,
            params.queueId,
            params.recipeId,
            params.initiatedByPrincipalId,
            params.quantityOrdered,
            params.jobNonce,
          ],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateJobNonceError(params.jobNonce)
        }
        throw err
      }
      const [rows] = await conn.execute<ProductionJobRow[]>(
        'SELECT * FROM atc_production_jobs WHERE id = ? LIMIT 1',
        [id],
      )
      if (!rows[0]) throw new ProductionJobNotFoundError(jobId)
      return rowToJob(rows[0])
    } finally {
      conn.release()
    }
  }

  async transition(
    jobId: string,
    status: AtcProductionStatus,
    opts?: { quantityProduced?: number; failedReason?: string },
  ): Promise<AtcProductionJob> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<ProductionJobRow[]>(
          'SELECT * FROM atc_production_jobs WHERE job_id = ? FOR UPDATE',
          [jobId],
        )
        if (!rows[0]) throw new ProductionJobNotFoundError(jobId)

        const setClauses: string[] = ['status = ?', 'updated_at = NOW(3)']
        const binds: (string | number | boolean | null)[] = [status]

        if (status === 'in_progress') {
          setClauses.push('started_at = NOW(3)')
        }

        if (status === 'completed' || status === 'failed' || status === 'cancelled') {
          setClauses.push('completed_at = NOW(3)')
        }

        if (opts?.quantityProduced !== undefined) {
          setClauses.push('quantity_produced = ?')
          binds.push(opts.quantityProduced)
        }

        if (opts?.failedReason !== undefined) {
          setClauses.push('failed_reason = ?')
          binds.push(opts.failedReason)
        }

        binds.push(jobId)

        await conn.execute(
          `UPDATE atc_production_jobs SET ${setClauses.join(', ')} WHERE job_id = ?`,
          binds,
        )

        const [updated] = await conn.execute<ProductionJobRow[]>(
          'SELECT * FROM atc_production_jobs WHERE job_id = ? LIMIT 1',
          [jobId],
        )
        if (!updated[0]) throw new ProductionJobNotFoundError(jobId)

        await conn.commit()
        return rowToJob(updated[0])
      } catch (err) {
        try {
          await conn.rollback()
        } catch {
        }
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async listByQueue(queueId: string): Promise<AtcProductionJob[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ProductionJobRow[]>(
        `SELECT * FROM atc_production_jobs
         WHERE queue_id = ?
         ORDER BY created_at DESC
         LIMIT 50`,
        [queueId],
      )
      return rows.map(rowToJob)
    } finally {
      conn.release()
    }
  }
}
