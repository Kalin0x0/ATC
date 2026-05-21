import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  WalletRepository,
  IdempotencyPayloadMismatchError,
  InsufficientFundsError,
  WalletFrozenError,
} from '@atc/db'

// ── Mock pool factory ─────────────────────────────────────────────────────────

function makeConn(overrides: Record<string, unknown> = {}) {
  return {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit:           vi.fn().mockResolvedValue(undefined),
    rollback:         vi.fn().mockResolvedValue(undefined),
    release:          vi.fn(),
    execute:          vi.fn(),
    ...overrides,
  }
}

function makePool(conn: ReturnType<typeof makeConn>) {
  return { getConnection: vi.fn().mockResolvedValue(conn) } as unknown as ConstructorParameters<typeof WalletRepository>[0]
}

// ── BIGINT overflow guard (BUG-2) ─────────────────────────────────────────────

describe('WalletRepository — BIGINT overflow guard (BUG-2)', () => {
  const CHAR_ID = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'
  const WALLET_ID = '01WALLETID000000000000000W1'

  function walletRow(cashBalance: string, bankBalance = '0') {
    return {
      id: WALLET_ID,
      character_id: CHAR_ID,
      currency: 'ATC',
      cash_balance: cashBalance,
      bank_balance: bankBalance,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    }
  }

  it('getOrCreate throws when cash_balance exceeds MAX_SAFE_INTEGER', async () => {
    const unsafeValue = String(Number.MAX_SAFE_INTEGER + 2)
    const conn = makeConn({
      execute: vi.fn().mockResolvedValue([[walletRow(unsafeValue)]]),
    })
    const repo = new WalletRepository(makePool(conn))
    await expect(repo.getOrCreate(CHAR_ID, 'ATC')).rejects.toThrow(/MAX_SAFE_INTEGER/)
  })

  it('getOrCreate succeeds when balance equals MAX_SAFE_INTEGER exactly', async () => {
    const safeValue = String(Number.MAX_SAFE_INTEGER)
    const conn = makeConn({
      execute: vi.fn().mockResolvedValue([[walletRow(safeValue)]]),
    })
    const repo = new WalletRepository(makePool(conn))
    const result = await repo.getOrCreate(CHAR_ID, 'ATC')
    expect(result.cashBalance).toBe(Number.MAX_SAFE_INTEGER)
  })
})

// ── getOrCreate race condition (BUG-1) ────────────────────────────────────────

describe('WalletRepository — getOrCreate race condition (BUG-1)', () => {
  const CHAR_ID = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'
  const WALLET_ID = '01WALLETID000000000000000W1'

  const existingRow = {
    id: WALLET_ID,
    character_id: CHAR_ID,
    currency: 'ATC',
    cash_balance: '0',
    bank_balance: '0',
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  }

  it('retries SELECT after ER_DUP_ENTRY on INSERT and returns the winning row', async () => {
    const dupError = Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' })
    const executeMock = vi.fn()
      .mockResolvedValueOnce([[]])           // first SELECT → no rows
      .mockRejectedValueOnce(dupError)       // INSERT → race loser
      .mockResolvedValueOnce([[existingRow]]) // retry SELECT → winner's row
    const conn = makeConn({ execute: executeMock })
    const repo = new WalletRepository(makePool(conn))

    const result = await repo.getOrCreate(CHAR_ID, 'ATC')
    expect(result.id).toBe(WALLET_ID)
    expect(executeMock).toHaveBeenCalledTimes(3)
  })

  it('re-throws non-duplicate errors from INSERT', async () => {
    const networkError = new Error('Connection lost')
    const executeMock = vi.fn()
      .mockResolvedValueOnce([[]])      // first SELECT → no rows
      .mockRejectedValueOnce(networkError) // INSERT → network failure
    const conn = makeConn({ execute: executeMock })
    const repo = new WalletRepository(makePool(conn))

    await expect(repo.getOrCreate(CHAR_ID, 'ATC')).rejects.toThrow('Connection lost')
  })
})

// ── Idempotency payload hash verification (BUG-7) ────────────────────────────

describe('WalletRepository — idempotency payload mismatch (BUG-7)', () => {
  const CHAR_ID   = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'
  const WALLET_ID = '01WALLETID000000000000000W1'
  const TX_ID     = '01TX0000000000000000000TX1'

  const baseParams = {
    characterId: CHAR_ID,
    currency: 'ATC',
    account: 'cash' as const,
    amount: 500,
    reason: 'reward',
    source: 'system' as const,
    idempotencyKey: 'idem-hash-test-001',
  }

  it('throws IdempotencyPayloadMismatchError when hash does not match', async () => {
    // Stored tx has hash for amount=999, but current request has amount=500
    const { createHash } = await import('node:crypto')
    const storedHash = createHash('sha256')
      .update(JSON.stringify({ amount: 999, account: 'cash', currency: 'ATC' }))
      .digest('hex')

    const existingTxRow = {
      id: TX_ID,
      wallet_id: WALLET_ID,
      character_id: CHAR_ID,
      type: 'credit',
      account: 'cash',
      amount: '999',
      balance_after: '999',
      currency: 'ATC',
      reason: 'old reward',
      source: 'system',
      idempotency_key: baseParams.idempotencyKey,
      payload_hash: storedHash,
      metadata: null,
      created_at: new Date(),
    }

    const executeMock = vi.fn()
      .mockResolvedValueOnce([[existingTxRow]]) // idempotency key SELECT → found
    const conn = makeConn({ execute: executeMock })
    const repo = new WalletRepository(makePool(conn))

    await expect(repo.credit(baseParams)).rejects.toBeInstanceOf(IdempotencyPayloadMismatchError)
  })

  it('replays successfully when hash matches', async () => {
    const { createHash } = await import('node:crypto')
    const correctHash = createHash('sha256')
      .update(JSON.stringify({ amount: 500, account: 'cash', currency: 'ATC' }))
      .digest('hex')

    const existingTxRow = {
      id: TX_ID,
      wallet_id: WALLET_ID,
      character_id: CHAR_ID,
      type: 'credit',
      account: 'cash',
      amount: '500',
      balance_after: '1500',
      currency: 'ATC',
      reason: 'reward',
      source: 'system',
      idempotency_key: baseParams.idempotencyKey,
      payload_hash: correctHash,
      metadata: null,
      created_at: new Date(),
    }

    const walletRow = {
      id: WALLET_ID,
      character_id: CHAR_ID,
      currency: 'ATC',
      cash_balance: '1500',
      bank_balance: '0',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    }

    const executeMock = vi.fn()
      .mockResolvedValueOnce([[existingTxRow]]) // idempotency key SELECT → found (replay)
      .mockResolvedValueOnce([[walletRow]])      // wallet SELECT for other account balance
    const conn = makeConn({ execute: executeMock })
    const repo = new WalletRepository(makePool(conn))

    const result = await repo.credit(baseParams)
    expect(result.idempotent).toBe(true)
    // BUG-3: tx.balanceAfter (1500) used for cash, wallet.bankBalance (0) used for bank
    expect(result.cashBalance).toBe(1500)
    expect(result.bankBalance).toBe(0)
    expect(result.amount).toBe(500)
  })

  it('skips hash verification when stored hash is null (pre-migration records)', async () => {
    const existingTxRow = {
      id: TX_ID,
      wallet_id: WALLET_ID,
      character_id: CHAR_ID,
      type: 'credit',
      account: 'cash',
      amount: '500',
      balance_after: '500',
      currency: 'ATC',
      reason: 'reward',
      source: 'system',
      idempotency_key: baseParams.idempotencyKey,
      payload_hash: null,
      metadata: null,
      created_at: new Date(),
    }

    const walletRow = {
      id: WALLET_ID,
      character_id: CHAR_ID,
      currency: 'ATC',
      cash_balance: '600',
      bank_balance: '0',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    }

    const executeMock = vi.fn()
      .mockResolvedValueOnce([[existingTxRow]])
      .mockResolvedValueOnce([[walletRow]])
    const conn = makeConn({ execute: executeMock })
    const repo = new WalletRepository(makePool(conn))

    // Should not throw even though the hash is null
    const result = await repo.credit(baseParams)
    expect(result.idempotent).toBe(true)
  })
})

// ── Debit — insufficient funds (regression guard) ────────────────────────────

describe('WalletRepository — debit guards', () => {
  const CHAR_ID   = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'
  const WALLET_ID = '01WALLETID000000000000000W1'

  const debitParams = {
    characterId: CHAR_ID,
    currency: 'ATC',
    account: 'cash' as const,
    amount: 1000,
    reason: 'purchase',
    source: 'gameplay' as const,
    idempotencyKey: 'idem-debit-guard-001',
  }

  it('throws InsufficientFundsError when cash balance is too low', async () => {
    const walletRow = {
      id: WALLET_ID, character_id: CHAR_ID, currency: 'ATC',
      cash_balance: '500', bank_balance: '0',
      status: 'active', created_at: new Date(), updated_at: new Date(),
    }

    const executeMock = vi.fn()
      .mockResolvedValueOnce([[]])         // idempotency SELECT → none
      .mockResolvedValueOnce([[walletRow]]) // wallet SELECT
    const conn = makeConn({ execute: executeMock })
    const repo = new WalletRepository(makePool(conn))

    await expect(repo.debit(debitParams)).rejects.toBeInstanceOf(InsufficientFundsError)
    expect(conn.rollback).toHaveBeenCalled()
  })

  it('throws WalletFrozenError when wallet is frozen', async () => {
    const frozenRow = {
      id: WALLET_ID, character_id: CHAR_ID, currency: 'ATC',
      cash_balance: '9999', bank_balance: '0',
      status: 'frozen', created_at: new Date(), updated_at: new Date(),
    }

    const executeMock = vi.fn()
      .mockResolvedValueOnce([[]])         // idempotency SELECT → none
      .mockResolvedValueOnce([[frozenRow]]) // wallet SELECT
    const conn = makeConn({ execute: executeMock })
    const repo = new WalletRepository(makePool(conn))

    await expect(repo.debit(debitParams)).rejects.toBeInstanceOf(WalletFrozenError)
  })
})
