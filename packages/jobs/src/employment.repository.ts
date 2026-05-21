import type { RowDataPacket } from 'mysql2/promise'
import type { AtcEmploymentContract, AtcEmploymentContractPage, EmploymentStatus } from '@atc/shared-types'
import type { JobsPool } from './pool.js'
import { generateId } from './id.js'
import {
  ContractNotFoundError,
  ContractAlreadyActiveError,
  ContractNotActiveError,
  ContractImmutableError,
  JobsValidationError,
} from './errors.js'

interface ContractRow extends RowDataPacket {
  id: string
  character_id: string
  organization_id: string | null
  job_id: string
  grade_id: string
  status: string
  salary_amount: string
  salary_currency: string
  started_at: Date
  ends_at: Date | null
  terminated_at: Date | null
  termination_reason: string | null
  created_by_principal_id: string
  created_at: Date
  updated_at: Date
}

function rowToContract(row: ContractRow): AtcEmploymentContract {
  return {
    id: row.id,
    characterId: row.character_id,
    organizationId: row.organization_id,
    jobId: row.job_id,
    gradeId: row.grade_id,
    status: row.status as EmploymentStatus,
    salaryAmount: parseFloat(row.salary_amount),
    salaryCurrency: row.salary_currency,
    startedAt: row.started_at,
    endsAt: row.ends_at,
    terminatedAt: row.terminated_at,
    terminationReason: row.termination_reason,
    createdByPrincipalId: row.created_by_principal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateContractParams {
  characterId: string
  organizationId?: string | null | undefined
  jobId: string
  gradeId: string
  salaryAmount: number
  salaryCurrency: string
  startedAt?: Date | undefined
  endsAt?: Date | null | undefined
  createdByPrincipalId: string
}

export interface ListContractsParams {
  characterId?: string | undefined
  organizationId?: string | undefined
  jobId?: string | undefined
  status?: EmploymentStatus | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export class EmploymentContractRepository {
  constructor(private readonly pool: JobsPool) {}

  async create(params: CreateContractParams): Promise<AtcEmploymentContract> {
    if (params.salaryAmount < 0) {
      throw new JobsValidationError('Salary amount must be non-negative')
    }
    if (!params.createdByPrincipalId) {
      throw new JobsValidationError('createdByPrincipalId is required')
    }

    const id = generateId()
    const startedAt = params.startedAt ?? new Date()
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      // Enforce one active contract per character per organization
      const [existingRows] = await conn.execute<ContractRow[]>(
        `SELECT id FROM atc_employment_contracts
         WHERE character_id = ?
           AND (organization_id = ? OR (organization_id IS NULL AND ? IS NULL))
           AND job_id = ?
           AND status = 'active'
         LIMIT 1 FOR UPDATE`,
        [
          params.characterId,
          params.organizationId ?? null,
          params.organizationId ?? null,
          params.jobId,
        ],
      )
      if (existingRows[0]) {
        await conn.rollback()
        throw new ContractAlreadyActiveError(params.characterId, params.organizationId ?? null)
      }

      await conn.execute(
        `INSERT INTO atc_employment_contracts
           (id, character_id, organization_id, job_id, grade_id, status,
            salary_amount, salary_currency, started_at, ends_at,
            created_by_principal_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [
          id, params.characterId, params.organizationId ?? null,
          params.jobId, params.gradeId,
          params.salaryAmount.toFixed(4), params.salaryCurrency,
          startedAt, params.endsAt ?? null,
          params.createdByPrincipalId,
        ],
      )

      await conn.commit()

      const contract = await this._findById(id)
      if (!contract) throw new ContractNotFoundError(id)
      return contract
    } catch (err) {
      try { await conn.rollback() } catch { /* best-effort */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcEmploymentContract | null> {
    return this._findById(id)
  }

  async findActiveForCharacter(
    characterId: string,
    organizationId: string | null,
    jobId: string,
  ): Promise<AtcEmploymentContract | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ContractRow[]>(
        `SELECT * FROM atc_employment_contracts
         WHERE character_id = ?
           AND (organization_id = ? OR (organization_id IS NULL AND ? IS NULL))
           AND job_id = ?
           AND status = 'active'
         LIMIT 1`,
        [characterId, organizationId, organizationId, jobId],
      )
      return rows[0] ? rowToContract(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async terminate(contractId: string, reason?: string): Promise<AtcEmploymentContract> {
    const conn = await this.pool.getConnection()
    try {
      // FIX BUG-7: Eliminate TOCTOU race — read, validate, and write inside a single
      // transaction with a FOR UPDATE lock so concurrent callers serialize correctly.
      await conn.beginTransaction()

      const [rows] = await conn.execute<ContractRow[]>(
        'SELECT * FROM atc_employment_contracts WHERE id = ? LIMIT 1 FOR UPDATE',
        [contractId],
      )
      const contract = rows[0]
      if (!contract) {
        await conn.rollback()
        throw new ContractNotFoundError(contractId)
      }
      if (contract.status === 'terminated') {
        await conn.rollback()
        throw new ContractImmutableError(contractId)
      }
      if (contract.status !== 'active' && contract.status !== 'suspended') {
        await conn.rollback()
        throw new ContractNotActiveError(contractId, contract.status)
      }

      await conn.execute(
        `UPDATE atc_employment_contracts
         SET status = 'terminated', terminated_at = NOW(3), termination_reason = ?, updated_at = NOW(3)
         WHERE id = ?`,
        [reason ?? null, contractId],
      )

      await conn.commit()

      const [updatedRows] = await conn.execute<ContractRow[]>(
        'SELECT * FROM atc_employment_contracts WHERE id = ? LIMIT 1',
        [contractId],
      )
      if (!updatedRows[0]) throw new ContractNotFoundError(contractId)
      return rowToContract(updatedRows[0])
    } catch (err) {
      try { await conn.rollback() } catch { /* best-effort */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async list(params: ListContractsParams = {}): Promise<AtcEmploymentContractPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: (string | number | null)[] = []
    if (params.characterId)   { conditions.push('character_id = ?');   args.push(params.characterId) }
    if (params.organizationId){ conditions.push('organization_id = ?'); args.push(params.organizationId) }
    if (params.jobId)         { conditions.push('job_id = ?');          args.push(params.jobId) }
    if (params.status)        { conditions.push('status = ?');          args.push(params.status) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_employment_contracts ${where}`, args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<ContractRow[]>(
        `SELECT * FROM atc_employment_contracts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToContract), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  private async _findById(id: string): Promise<AtcEmploymentContract | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ContractRow[]>(
        'SELECT * FROM atc_employment_contracts WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToContract(rows[0]) : null
    } finally {
      conn.release()
    }
  }
}
