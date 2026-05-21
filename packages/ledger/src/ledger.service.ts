import type { RowDataPacket, PoolConnection } from 'mysql2/promise'
import type {
  FinancialJournalWithEntries,
  FinancialEntry,
  JournalStatus,
  JournalEntryType,
  JournalSource,
  FinancialJournalPage,
} from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import type { LedgerPool } from './pool.js'
import { generateId } from './id.js'
import {
  LedgerImbalanceError,
  LedgerInsufficientFundsError,
  LedgerAccountFrozenError,
  LedgerAccountNotFoundError,
  LedgerJournalNotFoundError,
  LedgerReversalError,
  LedgerValidationError,
  LedgerCurrencyMismatchError,
} from './errors.js'

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_AMOUNT = 1_000_000_000

// ── Row types ──────────────────────────────────────────────────────────────────

interface AccountRow extends RowDataPacket {
  id: string
  account_type: string
  status: string
  balance: string // DECIMAL as string
  currency: string
}

interface JournalRow extends RowDataPacket {
  id: string
  idempotency_key: string
  description: string
  source: string
  status: string
  reference_id: string | null
  reference_type: string | null
  reversal_of_id: string | null
  committed_at: Date | null
  reversed_at: Date | null
  created_at: Date
}

interface EntryRow extends RowDataPacket {
  id: string
  journal_id: string
  account_id: string
  entry_type: string
  amount: string // DECIMAL as string
  currency: string
  created_at: Date
}

// ── Param types ────────────────────────────────────────────────────────────────

export interface JournalEntryInput {
  accountId: string
  entryType: JournalEntryType
  amount: number
  currency: string
}

export interface CommitJournalParams {
  idempotencyKey: string
  description: string
  source: JournalSource
  entries: JournalEntryInput[]
  referenceId?: string | undefined
  referenceType?: string | undefined
}

export interface TransferParams {
  fromAccountId: string
  toAccountId: string
  amount: number
  currency: string
  idempotencyKey: string
  description?: string | undefined
  source?: JournalSource | undefined
  referenceId?: string | undefined
  referenceType?: string | undefined
}

export interface ListJournalsParams {
  status?: JournalStatus | undefined
  referenceType?: string | undefined
  referenceId?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function rowToJournalWithEntries(
  journalRow: JournalRow,
  entryRows: EntryRow[],
): FinancialJournalWithEntries {
  return {
    id: journalRow.id,
    idempotencyKey: journalRow.idempotency_key,
    description: journalRow.description,
    source: journalRow.source as JournalSource,
    status: journalRow.status as JournalStatus,
    referenceId: journalRow.reference_id,
    referenceType: journalRow.reference_type,
    reversalOfId: journalRow.reversal_of_id,
    committedAt: journalRow.committed_at,
    reversedAt: journalRow.reversed_at,
    createdAt: journalRow.created_at,
    entries: entryRows.map((e): FinancialEntry => ({
      id: e.id,
      journalId: e.journal_id,
      accountId: e.account_id,
      entryType: e.entry_type as JournalEntryType,
      amount: parseFloat(e.amount),
      currency: e.currency,
      createdAt: e.created_at,
    })),
  }
}

// ── Service ────────────────────────────────────────────────────────────────────

export class LedgerService {
  constructor(
    private readonly pool: LedgerPool,
    private readonly telemetry?: AtcTelemetryService,
  ) {}

  /**
   * Commit a double-entry journal atomically.
   * Validates: debits == credits per currency (integer arithmetic), all accounts active,
   * no negative balances (except system accounts), idempotency key uniqueness.
   * Returns the existing journal if the idempotency key was already committed.
   */
  async commit(params: CommitJournalParams): Promise<FinancialJournalWithEntries> {
    this._validateBalance(params.entries)

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      // Idempotency check — return existing journal if already committed
      const [existingRows] = await conn.execute<JournalRow[]>(
        'SELECT * FROM atc_financial_journals WHERE idempotency_key = ? LIMIT 1',
        [params.idempotencyKey],
      )
      if (existingRows[0]) {
        await conn.rollback()
        // Let finally release the connection; fetch via a new connection
        return await this._fetchJournalWithEntries(params.idempotencyKey, 'idempotency_key')
      }

      const result = await this._commitInTx(conn, params, null)
      await conn.commit()
      this.telemetry?.increment('economy.journals_committed_total')
      return result
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  /**
   * Convenience: debit fromAccount, credit toAccount, in one atomic journal.
   * Rejects same-account transfers.
   */
  async transfer(params: TransferParams): Promise<FinancialJournalWithEntries> {
    if (params.fromAccountId === params.toAccountId) {
      throw new LedgerValidationError('Cannot transfer to the same account')
    }
    const commitParams: CommitJournalParams = {
      idempotencyKey: params.idempotencyKey,
      description: params.description ?? `Transfer ${params.amount} ${params.currency} from ${params.fromAccountId} to ${params.toAccountId}`,
      source: params.source ?? 'system',
      entries: [
        { accountId: params.fromAccountId, entryType: 'debit', amount: params.amount, currency: params.currency },
        { accountId: params.toAccountId, entryType: 'credit', amount: params.amount, currency: params.currency },
      ],
    }
    if (params.referenceId !== undefined) commitParams.referenceId = params.referenceId
    if (params.referenceType !== undefined) commitParams.referenceType = params.referenceType
    return this.commit(commitParams)
  }

  /**
   * Reverse a committed journal in one atomic transaction.
   * The original journal is marked 'reversed'; a new reversal journal is committed.
   * Returns the new reversal journal.
   */
  async reverse(journalId: string, idempotencyKey: string): Promise<FinancialJournalWithEntries> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      // Idempotency — return existing reversal if already committed
      const [existingRows] = await conn.execute<JournalRow[]>(
        'SELECT * FROM atc_financial_journals WHERE idempotency_key = ? LIMIT 1',
        [idempotencyKey],
      )
      if (existingRows[0]) {
        await conn.rollback()
        // Let finally release the connection; fetch via a new connection
        return await this._fetchJournalWithEntries(idempotencyKey, 'idempotency_key')
      }

      // Lock original journal
      const [origRows] = await conn.execute<JournalRow[]>(
        'SELECT * FROM atc_financial_journals WHERE id = ? FOR UPDATE',
        [journalId],
      )
      const origJournal = origRows[0]
      if (!origJournal) throw new LedgerJournalNotFoundError(journalId)
      if (origJournal.status !== 'committed') throw new LedgerReversalError(journalId, origJournal.status)

      // Fetch original entries
      const [entryRows] = await conn.execute<EntryRow[]>(
        'SELECT * FROM atc_financial_entries WHERE journal_id = ?',
        [journalId],
      )

      // Build reversal entries (swap debit/credit)
      const reversalEntries: JournalEntryInput[] = entryRows.map((e) => ({
        accountId: e.account_id,
        entryType: (e.entry_type === 'debit' ? 'credit' : 'debit') as JournalEntryType,
        amount: parseFloat(e.amount),
        currency: e.currency,
      }))

      // Validate the reversal entries balance (guards against corrupt stored entries)
      this._validateBalance(reversalEntries)

      const reversalParams: CommitJournalParams = {
        idempotencyKey,
        description: `Reversal of journal ${journalId}`,
        source: 'system',
        entries: reversalEntries,
      }

      const result = await this._commitInTx(conn, reversalParams, journalId)

      // Mark original as reversed
      await conn.execute(
        `UPDATE atc_financial_journals SET status = 'reversed', reversed_at = NOW(3) WHERE id = ?`,
        [journalId],
      )

      await conn.commit()
      this.telemetry?.increment('economy.journals_reversed_total')
      return result
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  /**
   * Commit a journal within a caller-owned connection/transaction.
   * The caller is responsible for BEGIN / COMMIT / ROLLBACK / release.
   * Use this when the ledger commit must be atomic with other SQL operations
   * (e.g. inventory mutations, stock decrements) in a single DB transaction.
   * Idempotency key uniqueness is enforced by the UNIQUE constraint — if you
   * need idempotency, check at the order/orchestration level before calling this.
   */
  async commitInTransaction(
    conn: PoolConnection,
    params: CommitJournalParams,
  ): Promise<FinancialJournalWithEntries> {
    this._validateBalance(params.entries)
    return this._commitInTx(conn, params, null)
  }

  async getJournal(journalId: string): Promise<FinancialJournalWithEntries | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<JournalRow[]>(
        'SELECT * FROM atc_financial_journals WHERE id = ? LIMIT 1',
        [journalId],
      )
      if (!rows[0]) return null
      const [entryRows] = await conn.execute<EntryRow[]>(
        'SELECT * FROM atc_financial_entries WHERE journal_id = ? ORDER BY created_at ASC',
        [journalId],
      )
      return rowToJournalWithEntries(rows[0], entryRows)
    } finally {
      conn.release()
    }
  }

  async listJournals(params: ListJournalsParams = {}): Promise<FinancialJournalPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const filterArgs: string[] = []

    if (params.status)        { conditions.push('status = ?');        filterArgs.push(params.status) }
    if (params.referenceType) { conditions.push('reference_type = ?'); filterArgs.push(params.referenceType) }
    if (params.referenceId)   { conditions.push('reference_id = ?');   filterArgs.push(params.referenceId) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_financial_journals ${where}`,
        filterArgs,
      )
      const total = countRows[0]?.total ?? 0

      const [journalRows] = await conn.execute<JournalRow[]>(
        `SELECT * FROM atc_financial_journals ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...filterArgs, limit, offset],
      )

      const items: FinancialJournalWithEntries[] = []
      for (const jr of journalRows) {
        const [entryRows] = await conn.execute<EntryRow[]>(
          'SELECT * FROM atc_financial_entries WHERE journal_id = ? ORDER BY created_at ASC',
          [jr.id],
        )
        items.push(rowToJournalWithEntries(jr, entryRows))
      }

      return { items, total, offset, limit }
    } finally {
      conn.release()
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * Validates that entries are non-empty, all amounts are positive finite values
   * within the allowed maximum, and debits == credits for each currency independently.
   */
  private _validateBalance(entries: JournalEntryInput[]): void {
    if (entries.length === 0) {
      throw new LedgerValidationError('Journal must have at least one entry')
    }

    const debitsByCurrency = new Map<string, number>()
    const creditsByCurrency = new Map<string, number>()

    for (const e of entries) {
      if (!Number.isFinite(e.amount) || e.amount <= 0) {
        throw new LedgerValidationError(
          `Entry amount must be a positive finite number, got: ${e.amount}`,
        )
      }
      if (e.amount > MAX_AMOUNT) {
        throw new LedgerValidationError(
          `Entry amount ${e.amount} exceeds maximum allowed amount ${MAX_AMOUNT}`,
        )
      }
      const units = Math.round(e.amount * 10000)
      if (e.entryType === 'debit') {
        debitsByCurrency.set(e.currency, (debitsByCurrency.get(e.currency) ?? 0) + units)
      } else {
        creditsByCurrency.set(e.currency, (creditsByCurrency.get(e.currency) ?? 0) + units)
      }
    }

    // Every currency must balance independently
    const allCurrencies = new Set([...debitsByCurrency.keys(), ...creditsByCurrency.keys()])
    for (const currency of allCurrencies) {
      const debits = debitsByCurrency.get(currency) ?? 0
      const credits = creditsByCurrency.get(currency) ?? 0
      if (debits !== credits) {
        throw new LedgerImbalanceError(debits, credits)
      }
    }
  }

  /**
   * Internal commit executed within a caller-managed transaction.
   * Locks accounts in sorted ID order to prevent deadlocks.
   * Validates account existence, active status, currency match, and sufficient balance.
   */
  private async _commitInTx(
    conn: PoolConnection,
    params: CommitJournalParams,
    reversalOfId: string | null,
  ): Promise<FinancialJournalWithEntries> {
    // Sorted account IDs for consistent locking order (deadlock prevention)
    const accountIds = [...new Set(params.entries.map((e) => e.accountId))].sort()
    const placeholders = accountIds.map(() => '?').join(', ')

    const [accountRows] = await conn.execute<AccountRow[]>(
      `SELECT id, account_type, status, balance, currency FROM atc_financial_accounts WHERE id IN (${placeholders}) FOR UPDATE`,
      accountIds,
    )

    // Validate all referenced accounts exist and are active
    for (const accountId of accountIds) {
      const row = accountRows.find((r) => r.id === accountId)
      if (!row) throw new LedgerAccountNotFoundError(accountId)
      if (row.status !== 'active') throw new LedgerAccountFrozenError(accountId, row.status)
    }

    // Validate entry currency matches account currency
    for (const entry of params.entries) {
      const row = accountRows.find((r) => r.id === entry.accountId)!
      if (entry.currency !== row.currency) {
        throw new LedgerCurrencyMismatchError(entry.accountId, row.currency, entry.currency)
      }
    }

    // Compute net balance delta per account (integer units of 1/10000)
    const balanceDeltas = new Map<string, number>()
    for (const entry of params.entries) {
      const current = balanceDeltas.get(entry.accountId) ?? 0
      const units = Math.round(entry.amount * 10000)
      balanceDeltas.set(
        entry.accountId,
        entry.entryType === 'debit' ? current - units : current + units,
      )
    }

    // Validate no negative balances (system accounts are exempt)
    for (const [accountId, delta] of balanceDeltas) {
      const row = accountRows.find((r) => r.id === accountId)!
      if (row.account_type === 'system') continue
      const currentUnits = Math.round(parseFloat(row.balance) * 10000)
      const newUnits = currentUnits + delta
      if (newUnits < 0) {
        throw new LedgerInsufficientFundsError(
          accountId,
          currentUnits / 10000,
          Math.abs(delta) / 10000,
        )
      }
    }

    // Insert journal record
    const journalId = generateId()
    const now = new Date()
    await conn.execute(
      `INSERT INTO atc_financial_journals
         (id, idempotency_key, description, source, status, reference_id, reference_type, reversal_of_id, committed_at, created_at)
       VALUES (?, ?, ?, ?, 'committed', ?, ?, ?, NOW(3), NOW(3))`,
      [
        journalId,
        params.idempotencyKey,
        params.description,
        params.source,
        params.referenceId ?? null,
        params.referenceType ?? null,
        reversalOfId,
      ],
    )

    // Insert entries and collect for return value
    const insertedEntries: FinancialEntry[] = []
    for (const entry of params.entries) {
      const entryId = generateId()
      await conn.execute(
        `INSERT INTO atc_financial_entries
           (id, journal_id, account_id, entry_type, amount, currency, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [entryId, journalId, entry.accountId, entry.entryType, entry.amount.toFixed(4), entry.currency],
      )
      insertedEntries.push({
        id: entryId,
        journalId,
        accountId: entry.accountId,
        entryType: entry.entryType,
        amount: entry.amount,
        currency: entry.currency,
        createdAt: now,
      })
    }

    // Update account balances atomically
    for (const [accountId, delta] of balanceDeltas) {
      const deltaDecimal = (delta / 10000).toFixed(4)
      await conn.execute(
        `UPDATE atc_financial_accounts
         SET balance = balance + ?, balance_version = balance_version + 1, updated_at = NOW(3)
         WHERE id = ?`,
        [deltaDecimal, accountId],
      )
    }

    return {
      id: journalId,
      idempotencyKey: params.idempotencyKey,
      description: params.description,
      source: params.source,
      status: 'committed',
      referenceId: params.referenceId ?? null,
      referenceType: params.referenceType ?? null,
      reversalOfId,
      committedAt: now,
      reversedAt: null,
      createdAt: now,
      entries: insertedEntries,
    }
  }

  private async _fetchJournalWithEntries(
    keyValue: string,
    keyColumn: 'id' | 'idempotency_key',
  ): Promise<FinancialJournalWithEntries> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<JournalRow[]>(
        `SELECT * FROM atc_financial_journals WHERE ${keyColumn} = ? LIMIT 1`,
        [keyValue],
      )
      const journal = rows[0]
      if (!journal) throw new LedgerJournalNotFoundError(keyValue)
      const [entryRows] = await conn.execute<EntryRow[]>(
        'SELECT * FROM atc_financial_entries WHERE journal_id = ? ORDER BY created_at ASC',
        [journal.id],
      )
      return rowToJournalWithEntries(journal, entryRows)
    } finally {
      conn.release()
    }
  }
}
