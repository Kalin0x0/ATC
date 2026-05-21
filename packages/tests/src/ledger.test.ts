import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolConnection } from 'mysql2/promise'
import { LedgerService } from '@atc/ledger'
import {
  LedgerImbalanceError,
  LedgerInsufficientFundsError,
  LedgerAccountFrozenError,
  LedgerAccountNotFoundError,
  LedgerJournalNotFoundError,
  LedgerReversalError,
  LedgerValidationError,
  LedgerCurrencyMismatchError,
} from '@atc/ledger'
import type { LedgerPool } from '@atc/ledger'
import { AccountRepository } from '@atc/ledger'

// ── Mock pool helpers ──────────────────────────────────────────────────────────

function makeConn(executeImpl: (sql: string, values?: unknown[]) => Promise<unknown[][]>): PoolConnection {
  return {
    execute: vi.fn(executeImpl) as PoolConnection['execute'],
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  } as unknown as PoolConnection
}

function makePool(conn: PoolConnection): LedgerPool {
  return { getConnection: vi.fn().mockResolvedValue(conn) }
}

// Active account rows for mock
function activeAccountRow(id: string, balance = '1000.0000', accountType = 'bank', currency = 'USD') {
  return { id, account_type: accountType, status: 'active', balance, currency }
}

// ── LedgerService.commit ───────────────────────────────────────────────────────

describe('LedgerService.commit', () => {
  it('throws LedgerImbalanceError when debits != credits', async () => {
    const conn = makeConn(async () => [[]])
    const pool = makePool(conn)
    const svc = new LedgerService(pool)

    await expect(
      svc.commit({
        idempotencyKey: 'test-1',
        description: 'Imbalanced journal',
        source: 'system',
        entries: [
          { accountId: 'acc-a', entryType: 'debit', amount: 100, currency: 'USD' },
          { accountId: 'acc-b', entryType: 'credit', amount: 50, currency: 'USD' },
        ],
      }),
    ).rejects.toThrow(LedgerImbalanceError)
  })

  it('returns existing journal on idempotency key replay', async () => {
    const existingJournal = {
      id: 'jrn-existing',
      idempotency_key: 'idem-1',
      description: 'First commit',
      source: 'system',
      status: 'committed',
      reference_id: null,
      reference_type: null,
      reversal_of_id: null,
      committed_at: new Date(),
      reversed_at: null,
      created_at: new Date(),
    }
    const callCount = { n: 0 }
    const conn = makeConn(async (sql) => {
      callCount.n++
      if (sql.includes('idempotency_key')) return [[existingJournal]]
      if (sql.includes('atc_financial_journals') && sql.includes('WHERE idempotency_key')) return [[existingJournal]]
      if (sql.includes('atc_financial_entries')) return [[]]
      return [[]]
    })
    const pool = makePool(conn)
    const svc = new LedgerService(pool)

    const result = await svc.commit({
      idempotencyKey: 'idem-1',
      description: 'Replay',
      source: 'system',
      entries: [
        { accountId: 'a', entryType: 'debit', amount: 10, currency: 'USD' },
        { accountId: 'b', entryType: 'credit', amount: 10, currency: 'USD' },
      ],
    })

    expect(result.id).toBe('jrn-existing')
  })

  it('throws LedgerAccountNotFoundError for missing account', async () => {
    let callN = 0
    const conn = makeConn(async (sql) => {
      callN++
      if (callN === 1) return [[]] // idempotency check — empty
      if (sql.includes('FOR UPDATE')) return [[]] // no accounts found
      return [[]]
    })
    const pool = makePool(conn)
    const svc = new LedgerService(pool)

    await expect(
      svc.commit({
        idempotencyKey: 'test-notfound',
        description: 'Missing account',
        source: 'system',
        entries: [
          { accountId: 'missing-a', entryType: 'debit', amount: 10, currency: 'USD' },
          { accountId: 'missing-b', entryType: 'credit', amount: 10, currency: 'USD' },
        ],
      }),
    ).rejects.toThrow(LedgerAccountNotFoundError)
  })

  it('throws LedgerAccountFrozenError for frozen account', async () => {
    let callN = 0
    const conn = makeConn(async (sql) => {
      callN++
      if (callN === 1) return [[]] // idempotency check
      if (sql.includes('FOR UPDATE')) {
        return [[
          { id: 'acc-a', account_type: 'bank', status: 'frozen', balance: '500.0000', currency: 'USD' },
          { id: 'acc-b', account_type: 'bank', status: 'active', balance: '0.0000', currency: 'USD' },
        ]]
      }
      return [[]]
    })
    const pool = makePool(conn)
    const svc = new LedgerService(pool)

    await expect(
      svc.commit({
        idempotencyKey: 'test-frozen',
        description: 'Frozen account',
        source: 'system',
        entries: [
          { accountId: 'acc-a', entryType: 'debit', amount: 10, currency: 'USD' },
          { accountId: 'acc-b', entryType: 'credit', amount: 10, currency: 'USD' },
        ],
      }),
    ).rejects.toThrow(LedgerAccountFrozenError)
  })

  it('throws LedgerInsufficientFundsError when balance would go negative', async () => {
    let callN = 0
    const conn = makeConn(async (sql) => {
      callN++
      if (callN === 1) return [[]] // idempotency check
      if (sql.includes('FOR UPDATE')) {
        return [[
          activeAccountRow('acc-a', '5.0000'),
          activeAccountRow('acc-b', '0.0000'),
        ]]
      }
      return [[]]
    })
    const pool = makePool(conn)
    const svc = new LedgerService(pool)

    await expect(
      svc.commit({
        idempotencyKey: 'test-insuff',
        description: 'Overdraft attempt',
        source: 'api',
        entries: [
          { accountId: 'acc-a', entryType: 'debit', amount: 100, currency: 'USD' },
          { accountId: 'acc-b', entryType: 'credit', amount: 100, currency: 'USD' },
        ],
      }),
    ).rejects.toThrow(LedgerInsufficientFundsError)
  })

  it('system accounts may go below zero', async () => {
    let callN = 0
    const insertedJournalId = 'jrn-sys-1'
    const conn = makeConn(async (sql) => {
      callN++
      if (callN === 1) return [[]] // idempotency check
      if (sql.includes('FOR UPDATE')) {
        return [[
          { id: 'sys-acc', account_type: 'system', status: 'active', balance: '0.0000', currency: 'USD' },
          activeAccountRow('usr-acc', '0.0000'),
        ]]
      }
      if (sql.includes('INSERT INTO atc_financial_journals')) return [{ insertId: insertedJournalId }]
      if (sql.includes('INSERT INTO atc_financial_entries')) return [{ insertId: 'entry-1' }]
      if (sql.includes('UPDATE atc_financial_accounts')) return [{ affectedRows: 1 }]
      return [[]]
    })
    const pool = makePool(conn)
    const svc = new LedgerService(pool)

    const result = await svc.commit({
      idempotencyKey: 'sys-mint',
      description: 'Mint currency',
      source: 'system',
      entries: [
        { accountId: 'sys-acc', entryType: 'debit', amount: 1000, currency: 'USD' },
        { accountId: 'usr-acc', entryType: 'credit', amount: 1000, currency: 'USD' },
      ],
    })

    expect(result.status).toBe('committed')
    expect(result.entries).toHaveLength(2)
  })

  it('integer arithmetic: 0.1 + 0.2 precision is exact', async () => {
    const svc = new LedgerService({ getConnection: vi.fn() })
    // Use the exported error to verify balance validation logic
    // 0.1 debit + 0.2 debit vs 0.3 credit — floating point would fail without integer math
    // Internally: Math.round(0.1*10000)=1000, Math.round(0.2*10000)=2000 → 3000
    //             Math.round(0.3*10000)=3000 → 3000. Equal!
    const entries = [
      { accountId: 'a', entryType: 'debit' as const, amount: 0.1, currency: 'USD' },
      { accountId: 'a', entryType: 'debit' as const, amount: 0.2, currency: 'USD' },
      { accountId: 'b', entryType: 'credit' as const, amount: 0.3, currency: 'USD' },
    ]
    // Should NOT throw LedgerImbalanceError (floating point 0.1+0.2=0.30000000000000004)
    // The internal _validateBalance must pass
    // We can test this by checking the error is NOT thrown before the pool is called
    const conn = makeConn(async () => { throw new Error('should not reach pool') })
    const poolWithError = makePool(conn)
    const svcWithPool = new LedgerService(poolWithError)
    // Since the pool is not called (error comes first), we expect pool.getConnection not called
    // Actually, _validateBalance IS called first — if it throws, pool is never called
    // If it does NOT throw, pool.getConnection IS called → will throw 'should not reach pool'
    await expect(
      svcWithPool.commit({ idempotencyKey: 'precision', description: 'test', source: 'system', entries }),
    ).rejects.toThrow('should not reach pool') // NOT LedgerImbalanceError
  })
})

// ── LedgerService.transfer ─────────────────────────────────────────────────────

describe('LedgerService.transfer', () => {
  it('builds a balanced 2-entry journal', async () => {
    let callN = 0
    const conn = makeConn(async (sql) => {
      callN++
      if (callN === 1) return [[]] // idempotency
      if (sql.includes('FOR UPDATE')) {
        return [[
          activeAccountRow('from-acc', '500.0000'),
          activeAccountRow('to-acc', '0.0000'),
        ]]
      }
      if (sql.includes('INSERT INTO atc_financial_journals')) return [{ insertId: 'jrn-t1' }]
      if (sql.includes('INSERT INTO atc_financial_entries')) return [{ insertId: 'ent-1' }]
      if (sql.includes('UPDATE')) return [{ affectedRows: 1 }]
      return [[]]
    })
    const pool = makePool(conn)
    const svc = new LedgerService(pool)

    const result = await svc.transfer({
      fromAccountId: 'from-acc',
      toAccountId: 'to-acc',
      amount: 100,
      currency: 'USD',
      idempotencyKey: 'xfer-1',
    })

    expect(result.entries).toHaveLength(2)
    const debit = result.entries.find((e) => e.entryType === 'debit')
    const credit = result.entries.find((e) => e.entryType === 'credit')
    expect(debit?.accountId).toBe('from-acc')
    expect(credit?.accountId).toBe('to-acc')
    expect(debit?.amount).toBe(100)
    expect(credit?.amount).toBe(100)
  })
})

// ── LedgerService.reverse ──────────────────────────────────────────────────────

describe('LedgerService.reverse', () => {
  it('throws LedgerJournalNotFoundError for unknown journal', async () => {
    let callN = 0
    const conn = makeConn(async () => {
      callN++
      return [[]] // always empty
    })
    const pool = makePool(conn)
    const svc = new LedgerService(pool)

    await expect(
      svc.reverse('nonexistent', 'rev-idem-1'),
    ).rejects.toThrow(LedgerJournalNotFoundError)
  })

  it('throws LedgerReversalError when journal is not committed', async () => {
    let callN = 0
    const conn = makeConn(async (sql) => {
      callN++
      if (callN === 1) return [[]] // idempotency check for reversal key
      if (sql.includes('FOR UPDATE')) {
        return [[{
          id: 'jrn-rev',
          idempotency_key: 'orig',
          description: 'Already reversed',
          source: 'system',
          status: 'reversed',
          reference_id: null,
          reference_type: null,
          reversal_of_id: null,
          committed_at: new Date(),
          reversed_at: new Date(),
          created_at: new Date(),
        }]]
      }
      return [[]]
    })
    const pool = makePool(conn)
    const svc = new LedgerService(pool)

    await expect(
      svc.reverse('jrn-rev', 'rev-idem-2'),
    ).rejects.toThrow(LedgerReversalError)
  })
})

// ── LedgerService.getJournal ───────────────────────────────────────────────────

describe('LedgerService.getJournal', () => {
  it('returns null for unknown journal', async () => {
    const conn = makeConn(async () => [[]])
    const pool = makePool(conn)
    const svc = new LedgerService(pool)

    const result = await svc.getJournal('nonexistent')
    expect(result).toBeNull()
  })

  it('returns journal with entries', async () => {
    const journalRow = {
      id: 'jrn-42',
      idempotency_key: 'k-42',
      description: 'Test',
      source: 'system',
      status: 'committed',
      reference_id: null,
      reference_type: null,
      reversal_of_id: null,
      committed_at: new Date(),
      reversed_at: null,
      created_at: new Date(),
    }
    const entryRow = {
      id: 'ent-1',
      journal_id: 'jrn-42',
      account_id: 'acc-1',
      entry_type: 'debit',
      amount: '50.0000',
      currency: 'USD',
      created_at: new Date(),
    }
    let callN = 0
    const conn = makeConn(async (sql) => {
      callN++
      if (sql.includes('atc_financial_journals')) return [[journalRow]]
      if (sql.includes('atc_financial_entries')) return [[entryRow]]
      return [[]]
    })
    const pool = makePool(conn)
    const svc = new LedgerService(pool)

    const result = await svc.getJournal('jrn-42')
    expect(result?.id).toBe('jrn-42')
    expect(result?.entries).toHaveLength(1)
    expect(result?.entries[0]?.amount).toBe(50)
  })
})

// ── AccountRepository ──────────────────────────────────────────────────────────

describe('AccountRepository.create', () => {
  it('creates an account and returns it', async () => {
    const accountRow = {
      id: 'acc-new',
      owner_type: 'character',
      owner_id: 'char-1',
      account_type: 'bank',
      currency: 'USD',
      balance: '0.0000',
      balance_version: 0,
      status: 'active',
      metadata: null,
      created_at: new Date(),
      updated_at: new Date(),
    }
    let callN = 0
    const conn = makeConn(async (sql) => {
      callN++
      if (sql.includes('INSERT')) return [{ insertId: 'acc-new' }]
      if (sql.includes('SELECT')) return [[accountRow]]
      return [[]]
    })
    const pool = makePool(conn)
    const repo = new AccountRepository(pool)

    const account = await repo.create({
      ownerType: 'character',
      ownerId: 'char-1',
      accountType: 'bank',
      currency: 'USD',
    })

    expect(account.id).toBe('acc-new')
    expect(account.balance).toBe(0)
    expect(account.status).toBe('active')
    expect(account.currency).toBe('USD')
  })
})

describe('AccountRepository.updateStatus', () => {
  it('freezes an account', async () => {
    const frozenRow = {
      id: 'acc-1',
      owner_type: 'character',
      owner_id: 'char-1',
      account_type: 'bank',
      currency: 'USD',
      balance: '500.0000',
      balance_version: 3,
      status: 'frozen',
      metadata: null,
      created_at: new Date(),
      updated_at: new Date(),
    }
    const conn = makeConn(async (sql) => {
      if (sql.includes('UPDATE')) return [{ affectedRows: 1 }]
      if (sql.includes('SELECT')) return [[frozenRow]]
      return [[]]
    })
    const pool = makePool(conn)
    const repo = new AccountRepository(pool)

    const result = await repo.updateStatus('acc-1', 'frozen')
    expect(result?.status).toBe('frozen')
  })
})

// ── Hardening: LedgerValidationError ──────────────────────────────────────────

describe('LedgerService — hardening: validation', () => {
  it('throws LedgerValidationError for empty entries array', async () => {
    const svc = new LedgerService({ getConnection: vi.fn() })
    await expect(
      svc.commit({ idempotencyKey: 'empty', description: 'test', source: 'system', entries: [] }),
    ).rejects.toThrow(LedgerValidationError)
  })

  it('throws LedgerValidationError for zero amount', async () => {
    const svc = new LedgerService({ getConnection: vi.fn() })
    await expect(
      svc.commit({
        idempotencyKey: 'zero', description: 'test', source: 'system',
        entries: [
          { accountId: 'a', entryType: 'debit', amount: 0, currency: 'USD' },
          { accountId: 'b', entryType: 'credit', amount: 0, currency: 'USD' },
        ],
      }),
    ).rejects.toThrow(LedgerValidationError)
  })

  it('throws LedgerValidationError for negative amount', async () => {
    const svc = new LedgerService({ getConnection: vi.fn() })
    await expect(
      svc.commit({
        idempotencyKey: 'neg', description: 'test', source: 'system',
        entries: [
          { accountId: 'a', entryType: 'debit', amount: -10, currency: 'USD' },
          { accountId: 'b', entryType: 'credit', amount: -10, currency: 'USD' },
        ],
      }),
    ).rejects.toThrow(LedgerValidationError)
  })

  it('throws LedgerValidationError for non-finite amount', async () => {
    const svc = new LedgerService({ getConnection: vi.fn() })
    await expect(
      svc.commit({
        idempotencyKey: 'inf', description: 'test', source: 'system',
        entries: [
          { accountId: 'a', entryType: 'debit', amount: Infinity, currency: 'USD' },
          { accountId: 'b', entryType: 'credit', amount: Infinity, currency: 'USD' },
        ],
      }),
    ).rejects.toThrow(LedgerValidationError)
  })

  it('throws LedgerValidationError for amount exceeding MAX_AMOUNT', async () => {
    const svc = new LedgerService({ getConnection: vi.fn() })
    await expect(
      svc.commit({
        idempotencyKey: 'huge', description: 'test', source: 'system',
        entries: [
          { accountId: 'a', entryType: 'debit', amount: 1_000_000_001, currency: 'USD' },
          { accountId: 'b', entryType: 'credit', amount: 1_000_000_001, currency: 'USD' },
        ],
      }),
    ).rejects.toThrow(LedgerValidationError)
  })

  it('throws LedgerImbalanceError when USD debits != USD credits', async () => {
    const svc = new LedgerService({ getConnection: vi.fn() })
    await expect(
      svc.commit({
        idempotencyKey: 'imbal', description: 'test', source: 'system',
        entries: [
          { accountId: 'a', entryType: 'debit', amount: 100, currency: 'USD' },
          { accountId: 'b', entryType: 'credit', amount: 90, currency: 'USD' },
        ],
      }),
    ).rejects.toThrow(LedgerImbalanceError)
  })

  it('throws LedgerImbalanceError when currencies are mixed (100 USD debit + 100 EUR credit)', async () => {
    const svc = new LedgerService({ getConnection: vi.fn() })
    await expect(
      svc.commit({
        idempotencyKey: 'mixcur', description: 'test', source: 'system',
        entries: [
          { accountId: 'a', entryType: 'debit', amount: 100, currency: 'USD' },
          { accountId: 'b', entryType: 'credit', amount: 100, currency: 'EUR' },
        ],
      }),
    ).rejects.toThrow(LedgerImbalanceError)
  })

  it('throws LedgerValidationError for same-account transfer', async () => {
    const svc = new LedgerService({ getConnection: vi.fn() })
    await expect(
      svc.transfer({
        fromAccountId: 'same-acc',
        toAccountId: 'same-acc',
        amount: 100,
        currency: 'USD',
        idempotencyKey: 'same',
      }),
    ).rejects.toThrow(LedgerValidationError)
  })
})

// ── Hardening: LedgerCurrencyMismatchError ─────────────────────────────────────

describe('LedgerService — hardening: currency mismatch', () => {
  it('throws LedgerCurrencyMismatchError when entry currency != account currency', async () => {
    let callN = 0
    const conn = makeConn(async (sql) => {
      callN++
      if (callN === 1) return [[]] // idempotency check
      if (sql.includes('FOR UPDATE')) {
        return [[
          { id: 'acc-eur', account_type: 'bank', status: 'active', balance: '1000.0000', currency: 'EUR' },
          { id: 'acc-usd', account_type: 'bank', status: 'active', balance: '0.0000', currency: 'USD' },
        ]]
      }
      return [[]]
    })
    const pool = makePool(conn)
    const svc = new LedgerService(pool)

    await expect(
      svc.commit({
        idempotencyKey: 'cur-mismatch',
        description: 'Wrong currency',
        source: 'system',
        entries: [
          { accountId: 'acc-eur', entryType: 'debit', amount: 100, currency: 'USD' }, // USD on EUR account
          { accountId: 'acc-usd', entryType: 'credit', amount: 100, currency: 'USD' },
        ],
      }),
    ).rejects.toThrow(LedgerCurrencyMismatchError)
  })
})
