import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { AtcPayrollRun, AtcPayrollRunEntry, PayrollStatus } from '@atc/shared-types'
import type { JobsPool } from './pool.js'
import { generateId } from './id.js'
import { PayrollRunNotFoundError } from './errors.js'

interface PayrollRunRow extends RowDataPacket {
  id: string
  organization_id: string
  period_start: Date
  period_end: Date
  status: string
  total_amount: string
  currency: string
  employee_count: number
  ledger_journal_id: string | null
  idempotency_key: string
  failure_reason: string | null
  created_by_principal_id: string
  created_at: Date
  updated_at: Date
}

interface PayrollEntryRow extends RowDataPacket {
  id: string
  payroll_run_id: string
  contract_id: string
  character_id: string
  grade_id: string
  hours_worked: string
  salary_amount: string
  currency: string
  created_at: Date
}

function rowToRun(row: PayrollRunRow): AtcPayrollRun {
  return {
    id: row.id,
    organizationId: row.organization_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status as PayrollStatus,
    totalAmount: parseFloat(row.total_amount),
    currency: row.currency,
    employeeCount: row.employee_count,
    ledgerJournalId: row.ledger_journal_id,
    idempotencyKey: row.idempotency_key,
    failureReason: row.failure_reason,
    createdByPrincipalId: row.created_by_principal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToEntry(row: PayrollEntryRow): AtcPayrollRunEntry {
  return {
    id: row.id,
    payrollRunId: row.payroll_run_id,
    contractId: row.contract_id,
    characterId: row.character_id,
    gradeId: row.grade_id,
    hoursWorked: parseFloat(row.hours_worked),
    salaryAmount: parseFloat(row.salary_amount),
    currency: row.currency,
    createdAt: row.created_at,
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null &&
    'code' in err && (err as { code: string }).code === 'ER_DUP_ENTRY'
  )
}

export interface CreatePayrollRunParams {
  organizationId: string
  periodStart: Date
  periodEnd: Date
  currency: string
  idempotencyKey: string
  createdByPrincipalId: string
}

export interface PayrollEntryInput {
  contractId: string
  characterId: string
  gradeId: string
  hoursWorked: number
  salaryAmount: number
  currency: string
}

export class PayrollRepository {
  constructor(private readonly pool: JobsPool) {}

  async createPreview(
    params: CreatePayrollRunParams,
    entries: PayrollEntryInput[],
  ): Promise<AtcPayrollRun> {
    const runId = generateId()

    // FIX: use integer arithmetic to avoid float imprecision on DECIMAL(15,4) values.
    // Multiply each salary by 10000, sum as integers, then divide back.
    const totalAmountInt = entries.reduce(
      (sum, e) => sum + Math.round(e.salaryAmount * 10000),
      0,
    )
    const totalAmount = totalAmountInt / 10000

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      let replayKey: string | null = null
      try {
        await conn.execute(
          `INSERT INTO atc_payroll_runs
             (id, organization_id, period_start, period_end, status,
              total_amount, currency, employee_count,
              idempotency_key, created_by_principal_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'preview', ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
          [
            runId, params.organizationId,
            params.periodStart, params.periodEnd,
            totalAmount.toFixed(4), params.currency,
            entries.length,
            params.idempotencyKey, params.createdByPrincipalId,
          ],
        )
      } catch (insertErr: unknown) {
        if (isDuplicateKeyError(insertErr)) {
          // FIX: concurrent preview with same idempotency key — rollback and return existing run.
          await conn.rollback()
          replayKey = params.idempotencyKey
        } else {
          throw insertErr
        }
      }

      if (replayKey !== null) {
        // findByIdempotencyKey acquires its own connection; outer conn released by finally.
        const existing = await this.findByIdempotencyKey(replayKey)
        if (!existing) throw new PayrollRunNotFoundError(replayKey)
        return existing
      }

      for (const entry of entries) {
        const entryId = generateId()
        await conn.execute(
          `INSERT INTO atc_payroll_run_entries
             (id, payroll_run_id, contract_id, character_id, grade_id, hours_worked, salary_amount, currency, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
          [
            entryId, runId, entry.contractId, entry.characterId, entry.gradeId,
            entry.hoursWorked.toFixed(2), entry.salaryAmount.toFixed(4), entry.currency,
          ],
        )
      }

      await conn.commit()

      const run = await this.findById(runId)
      if (!run) throw new PayrollRunNotFoundError(runId)
      return run
    } catch (err) {
      try { await conn.rollback() } catch { /* best-effort */ }
      throw err
    } finally {
      conn.release()
    }
  }

  /**
   * Attempt to atomically transition a preview run to 'pending' status.
   * Returns true when the transition succeeded (this process owns the commit slot).
   * Returns false when another process already moved the run out of 'preview'.
   *
   * This is the distributed lock that prevents concurrent payroll commits.
   */
  async markPending(runId: string): Promise<boolean> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_payroll_runs
         SET status = 'pending', updated_at = NOW(3)
         WHERE id = ? AND status = 'preview'`,
        [runId],
      )
      return result.affectedRows === 1
    } finally {
      conn.release()
    }
  }

  async markCompleted(runId: string, journalId: string | null): Promise<AtcPayrollRun> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_payroll_runs
         SET status = 'completed', ledger_journal_id = ?, updated_at = NOW(3)
         WHERE id = ?`,
        [journalId, runId],
      )
      const run = await this.findById(runId)
      if (!run) throw new PayrollRunNotFoundError(runId)
      return run
    } finally {
      conn.release()
    }
  }

  async markFailed(runId: string, reason: string): Promise<AtcPayrollRun> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_payroll_runs
         SET status = 'failed', failure_reason = ?, updated_at = NOW(3)
         WHERE id = ?`,
        [reason, runId],
      )
      const run = await this.findById(runId)
      if (!run) throw new PayrollRunNotFoundError(runId)
      return run
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcPayrollRun | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PayrollRunRow[]>(
        'SELECT * FROM atc_payroll_runs WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToRun(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByIdempotencyKey(key: string): Promise<AtcPayrollRun | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PayrollRunRow[]>(
        'SELECT * FROM atc_payroll_runs WHERE idempotency_key = ? LIMIT 1',
        [key],
      )
      return rows[0] ? rowToRun(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async getEntries(runId: string): Promise<AtcPayrollRunEntry[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PayrollEntryRow[]>(
        'SELECT * FROM atc_payroll_run_entries WHERE payroll_run_id = ? ORDER BY created_at ASC',
        [runId],
      )
      return rows.map(rowToEntry)
    } finally {
      conn.release()
    }
  }

  async getActiveContractsForOrg(
    organizationId: string,
  ): Promise<Array<{ contractId: string; characterId: string; gradeId: string; salaryAmount: number; salaryCurrency: string }>> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<(RowDataPacket & {
        id: string; character_id: string; grade_id: string; salary_amount: string; salary_currency: string
      })[]>(
        `SELECT id, character_id, grade_id, salary_amount, salary_currency
         FROM atc_employment_contracts
         WHERE organization_id = ? AND status = 'active'`,
        [organizationId],
      )
      return rows.map((r) => ({
        contractId: r.id,
        characterId: r.character_id,
        gradeId: r.grade_id,
        salaryAmount: parseFloat(r.salary_amount),
        salaryCurrency: r.salary_currency,
      }))
    } finally {
      conn.release()
    }
  }
}
