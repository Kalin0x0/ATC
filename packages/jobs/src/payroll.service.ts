import type { AtcPayrollRun, AtcPayrollRunEntry } from '@atc/shared-types'
import { ATC_JOB_EVENTS as EVENTS } from '@atc/shared-types'
import type { LedgerService, CommitJournalParams } from '@atc/ledger'
import type { AtcTelemetryService } from '@atc/telemetry'
import type { PayrollRepository, CreatePayrollRunParams, PayrollEntryInput } from './payroll.repository.js'
import {
  PayrollRunNotFoundError,
  PayrollAlreadyCommittedError,
  JobsMisconfiguredError,
  JobsValidationError,
} from './errors.js'

export interface PreviewPayrollParams {
  organizationId: string
  periodStart: Date
  periodEnd: Date
  currency: string
  idempotencyKey: string
  createdByPrincipalId: string
}

export interface CommitPayrollParams {
  runId: string
  /** Financial account (org) that is debited for total payroll. */
  orgAccountId: string
  /** Financial account that receives payroll payable credits (e.g. a payroll clearing account). */
  payrollAccountId: string
}

export interface PayrollResult {
  run: AtcPayrollRun
  entries: AtcPayrollRunEntry[]
  journalId: string | null
}

export class PayrollService {
  constructor(
    private readonly payrollRepo: PayrollRepository,
    private readonly ledger: LedgerService,
    private readonly eventBus?: { emit: (event: string, payload: unknown) => unknown },
    private readonly telemetry?: AtcTelemetryService,
  ) {}

  /**
   * Create a payroll preview run for an organization.
   * Calculates amounts from active contracts — no money moves, no ledger entry.
   * Returns idempotently if the same idempotency key was already used.
   */
  async previewPayroll(params: PreviewPayrollParams): Promise<PayrollResult> {
    if (!params.idempotencyKey || params.idempotencyKey.length > 256) {
      throw new JobsValidationError('idempotencyKey must be a non-empty string of at most 256 characters')
    }
    if (params.periodEnd <= params.periodStart) {
      throw new JobsValidationError('periodEnd must be after periodStart')
    }

    // Idempotency: return existing run if key already used
    const existing = await this.payrollRepo.findByIdempotencyKey(params.idempotencyKey)
    if (existing) {
      const entries = await this.payrollRepo.getEntries(existing.id)
      return { run: existing, entries, journalId: existing.ledgerJournalId }
    }

    // Load all active contracts for the org
    const contracts = await this.payrollRepo.getActiveContractsForOrg(params.organizationId)

    // FIX BUG-6: Currency consistency — all contract salaries must match payroll currency.
    // A mixed-currency payroll run is ambiguous and would silently mismatch the ledger total.
    const mismatched = contracts.filter((c) => c.salaryCurrency !== params.currency)
    if (mismatched.length > 0) {
      throw new JobsValidationError(
        `Currency mismatch: payroll currency is '${params.currency}' but ` +
        `${mismatched.length} contract(s) use a different currency`,
      )
    }

    const entries: PayrollEntryInput[] = contracts.map((c) => ({
      contractId: c.contractId,
      characterId: c.characterId,
      gradeId: c.gradeId,
      hoursWorked: 0, // hours will be computed from work sessions in a future phase
      salaryAmount: c.salaryAmount,
      currency: c.salaryCurrency,
    }))

    const runParams: CreatePayrollRunParams = {
      organizationId: params.organizationId,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      currency: params.currency,
      idempotencyKey: params.idempotencyKey,
      createdByPrincipalId: params.createdByPrincipalId,
    }

    const run = await this.payrollRepo.createPreview(runParams, entries)
    const runEntries = await this.payrollRepo.getEntries(run.id)
    return { run, entries: runEntries, journalId: null }
  }

  /**
   * Commit a payroll run: creates an atomic ledger journal debiting the org account
   * and crediting a payroll clearing account for the total amount.
   * Idempotent — returns the existing committed run if already processed.
   */
  async commitPayroll(params: CommitPayrollParams): Promise<PayrollResult> {
    if (!params.orgAccountId) throw new JobsMisconfiguredError('orgAccountId is required for payroll commit')
    if (!params.payrollAccountId) throw new JobsMisconfiguredError('payrollAccountId is required for payroll commit')

    const run = await this.payrollRepo.findById(params.runId)
    if (!run) throw new PayrollRunNotFoundError(params.runId)

    if (run.status === 'completed') {
      const entries = await this.payrollRepo.getEntries(run.id)
      return { run, entries, journalId: run.ledgerJournalId }
    }

    // 'failed' or 'pending' (concurrent commit in flight) — both are terminal for this attempt.
    if (run.status !== 'preview') {
      throw new PayrollAlreadyCommittedError(params.runId)
    }

    // FIX BUG-1: Atomically transition preview → pending as a distributed lock.
    // Only one process can win this UPDATE; the loser gets affectedRows=0 and throws.
    const claimed = await this.payrollRepo.markPending(params.runId)
    if (!claimed) {
      throw new PayrollAlreadyCommittedError(params.runId)
    }

    const entries = await this.payrollRepo.getEntries(run.id)

    if (entries.length === 0) {
      // FIX BUG-5: No ledger journal when there are no entries — use null, not a string sentinel.
      const completed = await this.payrollRepo.markCompleted(params.runId, null)
      void this.eventBus?.emit(EVENTS.PAYROLL_COMPLETED, {
        runId: run.id, organizationId: run.organizationId,
        totalAmount: run.totalAmount, currency: run.currency,
      })
      this.telemetry?.increment('payroll.runs_total')
      return { run: completed, entries: [], journalId: null }
    }

    // Build ledger entries: org debit = total; payroll clearing credit = total
    const ledgerEntries: CommitJournalParams['entries'] = [
      {
        accountId: params.orgAccountId,
        entryType: 'debit',
        amount: run.totalAmount,
        currency: run.currency,
      },
      {
        accountId: params.payrollAccountId,
        entryType: 'credit',
        amount: run.totalAmount,
        currency: run.currency,
      },
    ]

    try {
      const journal = await this.ledger.commit({
        idempotencyKey: `payroll:${run.idempotencyKey}`,
        description: `Payroll run ${run.id} for org ${run.organizationId} — ${run.employeeCount} employees`,
        source: 'system',
        entries: ledgerEntries,
        referenceId: run.id,
        referenceType: 'payroll_run',
      })

      const completed = await this.payrollRepo.markCompleted(run.id, journal.id)
      const runEntries = await this.payrollRepo.getEntries(run.id)

      void this.eventBus?.emit(EVENTS.PAYROLL_COMPLETED, {
        runId: run.id, organizationId: run.organizationId,
        totalAmount: run.totalAmount, currency: run.currency,
        journalId: journal.id,
      })
      this.telemetry?.increment('payroll.runs_total')

      return { run: completed, entries: runEntries, journalId: journal.id }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      await this.payrollRepo.markFailed(run.id, reason)

      void this.eventBus?.emit(EVENTS.PAYROLL_FAILED, {
        runId: run.id, organizationId: run.organizationId, reason,
      })
      this.telemetry?.increment('payroll.failed_total')
      throw err
    }
  }
}
