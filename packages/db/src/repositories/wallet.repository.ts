import { createHash } from 'node:crypto'
import type { RowDataPacket } from 'mysql2/promise'
import type { DbPool } from '../client.js'
import { generateId } from '../id.js'
import type {
  AtcWalletStatus,
  AtcMoneyAccount,
  AtcTransactionType,
  AtcTransactionSource,
} from '@atc/shared-types'

// ── Custom errors ─────────────────────────────────────────────────────────────

export class WalletFrozenError extends Error {
  constructor(message = 'Wallet is frozen') {
    super(message)
    this.name = 'WalletFrozenError'
  }
}

export class WalletClosedError extends Error {
  constructor(message = 'Wallet is closed') {
    super(message)
    this.name = 'WalletClosedError'
  }
}

export class InsufficientFundsError extends Error {
  constructor(message = 'Insufficient funds') {
    super(message)
    this.name = 'InsufficientFundsError'
  }
}

export class DuplicateIdempotencyError extends Error {
  readonly existingData: MutationResult
  constructor(existingData: MutationResult) {
    super('Duplicate idempotency key — returning existing result')
    this.name = 'DuplicateIdempotencyError'
    this.existingData = existingData
  }
}

export class IdempotencyPayloadMismatchError extends Error {
  constructor(message = 'Idempotency key reused with a different payload') {
    super(message)
    this.name = 'IdempotencyPayloadMismatchError'
  }
}

// ── Record types ──────────────────────────────────────────────────────────────

export interface WalletRecord {
  id: string
  characterId: string
  currency: string
  cashBalance: number
  bankBalance: number
  status: AtcWalletStatus
  createdAt: Date
  updatedAt: Date
}

export interface TransactionRecord {
  id: string
  walletId: string
  characterId: string
  type: AtcTransactionType
  account: AtcMoneyAccount
  amount: number
  balanceAfter: number
  currency: string
  reason: string
  source: AtcTransactionSource
  idempotencyKey: string
  payloadHash: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
}

export interface MutationResult {
  transactionId: string
  walletId: string
  cashBalance: number
  bankBalance: number
  amount: number
  type: AtcTransactionType
  account: AtcMoneyAccount
  idempotent: boolean
}

export interface CreditParams {
  characterId: string
  currency: string
  account: AtcMoneyAccount
  amount: number
  reason: string
  source: AtcTransactionSource
  idempotencyKey: string
  metadata?: Record<string, unknown>
}

export interface DebitParams {
  characterId: string
  currency: string
  account: AtcMoneyAccount
  amount: number
  reason: string
  source: AtcTransactionSource
  idempotencyKey: string
  metadata?: Record<string, unknown>
}

export interface TransferParams {
  characterId: string
  currency: string
  fromAccount: AtcMoneyAccount
  toAccount: AtcMoneyAccount
  amount: number
  reason: string
  idempotencyKey: string
  metadata?: Record<string, unknown>
}

// ── DB row shapes ─────────────────────────────────────────────────────────────

interface WalletRow extends RowDataPacket {
  id: string
  character_id: string
  currency: string
  cash_balance: string
  bank_balance: string
  status: string
  created_at: Date
  updated_at: Date
}

interface TransactionRow extends RowDataPacket {
  id: string
  wallet_id: string
  character_id: string
  type: string
  account: string
  amount: string
  balance_after: string
  currency: string
  reason: string
  source: string
  idempotency_key: string
  payload_hash: string | null
  metadata: string | null
  created_at: Date
}

interface CountRow extends RowDataPacket {
  total: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// mysql2 returns BIGINT UNSIGNED columns as strings. Number() works for values
// up to Number.MAX_SAFE_INTEGER (≈9 quadrillion minor units). Anything larger
// would silently lose precision, which is a ledger integrity violation.
function assertSafeInteger(val: string, field: string): number {
  const n = Number(val)
  if (!Number.isSafeInteger(n)) {
    throw new Error(
      `Ledger integrity: ${field} value "${val}" exceeds Number.MAX_SAFE_INTEGER — precision loss risk`,
    )
  }
  return n
}

function computePayloadHash(canonical: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

function rowToWallet(row: WalletRow): WalletRecord {
  return {
    id: row.id,
    characterId: row.character_id,
    currency: row.currency,
    cashBalance: assertSafeInteger(row.cash_balance, 'cash_balance'),
    bankBalance: assertSafeInteger(row.bank_balance, 'bank_balance'),
    status: row.status as AtcWalletStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToTransaction(row: TransactionRow): TransactionRecord {
  let metadata: Record<string, unknown> | null = null
  if (row.metadata !== null) {
    try {
      metadata = JSON.parse(row.metadata) as Record<string, unknown>
    } catch {
      metadata = null
    }
  }
  return {
    id: row.id,
    walletId: row.wallet_id,
    characterId: row.character_id,
    type: row.type as AtcTransactionType,
    account: row.account as AtcMoneyAccount,
    amount: assertSafeInteger(row.amount, 'amount'),
    balanceAfter: assertSafeInteger(row.balance_after, 'balance_after'),
    currency: row.currency,
    reason: row.reason,
    source: row.source as AtcTransactionSource,
    idempotencyKey: row.idempotency_key,
    payloadHash: row.payload_hash,
    metadata,
    createdAt: row.created_at,
  }
}

function assertWalletActive(wallet: WalletRecord): void {
  if (wallet.status === 'frozen') throw new WalletFrozenError()
  if (wallet.status === 'closed') throw new WalletClosedError()
}

// ── Repository ────────────────────────────────────────────────────────────────

export class WalletRepository {
  constructor(private readonly pool: DbPool) {}

  async getOrCreate(characterId: string, currency: string): Promise<WalletRecord> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<WalletRow[]>(
        'SELECT * FROM atc_wallets WHERE character_id = ? AND currency = ? LIMIT 1',
        [characterId, currency],
      )
      if (rows[0]) return rowToWallet(rows[0])

      const id = generateId()
      try {
        await conn.execute(
          'INSERT INTO atc_wallets (id, character_id, currency, cash_balance, bank_balance, status) VALUES (?, ?, ?, 0, 0, "active")',
          [id, characterId, currency],
        )
      } catch (err: unknown) {
        // BUG-1: Two concurrent first-time calls both see no rows, both attempt INSERT.
        // The loser gets ER_DUP_ENTRY on the UNIQUE(character_id, currency) key.
        // Retry the SELECT to return the winner's row.
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          const [retried] = await conn.execute<WalletRow[]>(
            'SELECT * FROM atc_wallets WHERE character_id = ? AND currency = ? LIMIT 1',
            [characterId, currency],
          )
          if (retried[0]) return rowToWallet(retried[0])
        }
        throw err
      }

      const [created] = await conn.execute<WalletRow[]>(
        'SELECT * FROM atc_wallets WHERE id = ? LIMIT 1',
        [id],
      )
      return rowToWallet(created[0]!)
    } finally {
      conn.release()
    }
  }

  async getBalance(characterId: string, currency: string): Promise<WalletRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<WalletRow[]>(
        'SELECT * FROM atc_wallets WHERE character_id = ? AND currency = ? LIMIT 1',
        [characterId, currency],
      )
      return rows[0] ? rowToWallet(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async credit(params: CreditParams): Promise<MutationResult> {
    const { characterId, currency, account, amount, reason, source, idempotencyKey } = params
    const metadata = params.metadata ?? null
    const payloadHash = computePayloadHash({ amount, account, currency })

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      // Lock the idempotency key row (or gap) so concurrent identical requests serialize
      const [existing] = await conn.execute<TransactionRow[]>(
        'SELECT * FROM atc_wallet_transactions WHERE idempotency_key = ? FOR UPDATE',
        [idempotencyKey],
      )
      if (existing[0]) {
        await conn.commit()
        const tx = rowToTransaction(existing[0])

        // BUG-7: Detect reuse of the same idempotency key with a different payload
        if (tx.payloadHash !== null && tx.payloadHash !== payloadHash) {
          throw new IdempotencyPayloadMismatchError()
        }

        const [wRows] = await conn.execute<WalletRow[]>(
          'SELECT * FROM atc_wallets WHERE id = ? LIMIT 1',
          [tx.walletId],
        )
        const wallet = wRows[0] ? rowToWallet(wRows[0]) : { cashBalance: 0, bankBalance: 0 }

        // BUG-3: Use the recorded post-tx balance for the mutated account (exact),
        // and current balance for the untouched account (unchanged in normal retry flows).
        const cashBalance = tx.account === 'cash' ? tx.balanceAfter : wallet.cashBalance
        const bankBalance = tx.account === 'bank' ? tx.balanceAfter : wallet.bankBalance

        return {
          transactionId: tx.id,
          walletId: tx.walletId,
          cashBalance,
          bankBalance,
          amount: tx.amount,
          type: 'credit',
          account: tx.account,
          idempotent: true,
        }
      }

      // Get or create wallet inside the transaction with an exclusive lock
      let [wRows] = await conn.execute<WalletRow[]>(
        'SELECT * FROM atc_wallets WHERE character_id = ? AND currency = ? FOR UPDATE',
        [characterId, currency],
      )
      if (!wRows[0]) {
        const walletId = generateId()
        await conn.execute(
          'INSERT INTO atc_wallets (id, character_id, currency, cash_balance, bank_balance, status) VALUES (?, ?, ?, 0, 0, "active")',
          [walletId, characterId, currency],
        )
        ;[wRows] = await conn.execute<WalletRow[]>(
          'SELECT * FROM atc_wallets WHERE id = ? FOR UPDATE',
          [walletId],
        )
      }

      const wallet = rowToWallet(wRows[0]!)
      assertWalletActive(wallet)

      const newCash = account === 'cash' ? wallet.cashBalance + amount : wallet.cashBalance
      const newBank = account === 'bank' ? wallet.bankBalance + amount : wallet.bankBalance
      const balanceAfter = account === 'cash' ? newCash : newBank

      await conn.execute(
        'UPDATE atc_wallets SET cash_balance = ?, bank_balance = ? WHERE id = ?',
        [newCash, newBank, wallet.id],
      )

      const txId = generateId()
      await conn.execute(
        `INSERT INTO atc_wallet_transactions
           (id, wallet_id, character_id, type, account, amount, balance_after, currency, reason, source, idempotency_key, payload_hash, metadata)
         VALUES (?, ?, ?, 'credit', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [txId, wallet.id, characterId, account, amount, balanceAfter, currency, reason, source,
         idempotencyKey, payloadHash, metadata !== null ? JSON.stringify(metadata) : null],
      )

      await conn.commit()
      return {
        transactionId: txId,
        walletId: wallet.id,
        cashBalance: newCash,
        bankBalance: newBank,
        amount,
        type: 'credit',
        account,
        idempotent: false,
      }
    } catch (err) {
      try { await conn.rollback() } catch { /* ignore */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async debit(params: DebitParams): Promise<MutationResult> {
    const { characterId, currency, account, amount, reason, source, idempotencyKey } = params
    const metadata = params.metadata ?? null
    const payloadHash = computePayloadHash({ amount, account, currency })

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      const [existing] = await conn.execute<TransactionRow[]>(
        'SELECT * FROM atc_wallet_transactions WHERE idempotency_key = ? FOR UPDATE',
        [idempotencyKey],
      )
      if (existing[0]) {
        await conn.commit()
        const tx = rowToTransaction(existing[0])

        if (tx.payloadHash !== null && tx.payloadHash !== payloadHash) {
          throw new IdempotencyPayloadMismatchError()
        }

        const [wRows] = await conn.execute<WalletRow[]>(
          'SELECT * FROM atc_wallets WHERE id = ? LIMIT 1',
          [tx.walletId],
        )
        const wallet = wRows[0] ? rowToWallet(wRows[0]) : { cashBalance: 0, bankBalance: 0 }

        const cashBalance = tx.account === 'cash' ? tx.balanceAfter : wallet.cashBalance
        const bankBalance = tx.account === 'bank' ? tx.balanceAfter : wallet.bankBalance

        return {
          transactionId: tx.id,
          walletId: tx.walletId,
          cashBalance,
          bankBalance,
          amount: tx.amount,
          type: 'debit',
          account: tx.account,
          idempotent: true,
        }
      }

      const [wRows] = await conn.execute<WalletRow[]>(
        'SELECT * FROM atc_wallets WHERE character_id = ? AND currency = ? FOR UPDATE',
        [characterId, currency],
      )
      if (!wRows[0]) {
        await conn.rollback()
        throw new InsufficientFundsError('Wallet does not exist')
      }

      const wallet = rowToWallet(wRows[0])
      assertWalletActive(wallet)

      const currentBalance = account === 'cash' ? wallet.cashBalance : wallet.bankBalance
      if (currentBalance < amount) {
        await conn.rollback()
        throw new InsufficientFundsError()
      }

      const newCash = account === 'cash' ? wallet.cashBalance - amount : wallet.cashBalance
      const newBank = account === 'bank' ? wallet.bankBalance - amount : wallet.bankBalance
      const balanceAfter = account === 'cash' ? newCash : newBank

      await conn.execute(
        'UPDATE atc_wallets SET cash_balance = ?, bank_balance = ? WHERE id = ?',
        [newCash, newBank, wallet.id],
      )

      const txId = generateId()
      await conn.execute(
        `INSERT INTO atc_wallet_transactions
           (id, wallet_id, character_id, type, account, amount, balance_after, currency, reason, source, idempotency_key, payload_hash, metadata)
         VALUES (?, ?, ?, 'debit', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [txId, wallet.id, characterId, account, amount, balanceAfter, currency, reason, source,
         idempotencyKey, payloadHash, metadata !== null ? JSON.stringify(metadata) : null],
      )

      await conn.commit()
      return {
        transactionId: txId,
        walletId: wallet.id,
        cashBalance: newCash,
        bankBalance: newBank,
        amount,
        type: 'debit',
        account,
        idempotent: false,
      }
    } catch (err) {
      try { await conn.rollback() } catch { /* ignore */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async transfer(params: TransferParams): Promise<MutationResult> {
    const { characterId, currency, fromAccount, toAccount, amount, reason, idempotencyKey } = params
    const metadata = params.metadata ?? null
    const payloadHash = computePayloadHash({ amount, fromAccount, toAccount, currency })

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      const [existing] = await conn.execute<TransactionRow[]>(
        'SELECT * FROM atc_wallet_transactions WHERE idempotency_key = ? FOR UPDATE',
        [idempotencyKey],
      )
      if (existing[0]) {
        await conn.commit()
        const tx = rowToTransaction(existing[0])

        if (tx.payloadHash !== null && tx.payloadHash !== payloadHash) {
          throw new IdempotencyPayloadMismatchError()
        }

        const [wRows] = await conn.execute<WalletRow[]>(
          'SELECT * FROM atc_wallets WHERE id = ? LIMIT 1',
          [tx.walletId],
        )
        const wallet = wRows[0] ? rowToWallet(wRows[0]) : { cashBalance: 0, bankBalance: 0 }

        // BUG-3: For transfers both accounts change, so we store both post-tx balances
        // in the transaction metadata under internal _cashAfter/_bankAfter keys.
        const meta = tx.metadata as { _cashAfter?: unknown; _bankAfter?: unknown } | null
        const cashBalance =
          typeof meta?._cashAfter === 'number' && Number.isFinite(meta._cashAfter)
            ? meta._cashAfter
            : wallet.cashBalance
        const bankBalance =
          typeof meta?._bankAfter === 'number' && Number.isFinite(meta._bankAfter)
            ? meta._bankAfter
            : wallet.bankBalance

        return {
          transactionId: tx.id,
          walletId: tx.walletId,
          cashBalance,
          bankBalance,
          amount: tx.amount,
          type: 'transfer',
          account: fromAccount,
          idempotent: true,
        }
      }

      const [wRows] = await conn.execute<WalletRow[]>(
        'SELECT * FROM atc_wallets WHERE character_id = ? AND currency = ? FOR UPDATE',
        [characterId, currency],
      )
      if (!wRows[0]) {
        await conn.rollback()
        throw new InsufficientFundsError('Wallet does not exist')
      }

      const wallet = rowToWallet(wRows[0])
      assertWalletActive(wallet)

      const fromBalance = fromAccount === 'cash' ? wallet.cashBalance : wallet.bankBalance
      if (fromBalance < amount) {
        await conn.rollback()
        throw new InsufficientFundsError()
      }

      const newCash =
        fromAccount === 'cash'
          ? wallet.cashBalance - amount
          : wallet.cashBalance + amount
      const newBank =
        fromAccount === 'bank'
          ? wallet.bankBalance - amount
          : wallet.bankBalance + amount
      const balanceAfter = fromAccount === 'cash' ? newCash : newBank

      await conn.execute(
        'UPDATE atc_wallets SET cash_balance = ?, bank_balance = ? WHERE id = ?',
        [newCash, newBank, wallet.id],
      )

      const txId = generateId()
      // Store toAccount + both post-tx balances in metadata so idempotent replays
      // can reconstruct the exact response without re-reading the current wallet state.
      // source='api' is correct here: transfers always originate from the REST API layer.
      const metaWithInternal = { toAccount, _cashAfter: newCash, _bankAfter: newBank, ...(metadata ?? {}) }
      await conn.execute(
        `INSERT INTO atc_wallet_transactions
           (id, wallet_id, character_id, type, account, amount, balance_after, currency, reason, source, idempotency_key, payload_hash, metadata)
         VALUES (?, ?, ?, 'transfer', ?, ?, ?, ?, ?, 'api', ?, ?, ?)`,
        [txId, wallet.id, characterId, fromAccount, amount, balanceAfter, currency, reason,
         idempotencyKey, payloadHash, JSON.stringify(metaWithInternal)],
      )

      await conn.commit()
      return {
        transactionId: txId,
        walletId: wallet.id,
        cashBalance: newCash,
        bankBalance: newBank,
        amount,
        type: 'transfer',
        account: fromAccount,
        idempotent: false,
      }
    } catch (err) {
      try { await conn.rollback() } catch { /* ignore */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async listTransactions(
    characterId: string,
    currency: string,
    limit: number,
    offset: number,
  ): Promise<{ transactions: TransactionRecord[]; total: number }> {
    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<CountRow[]>(
        'SELECT COUNT(*) AS total FROM atc_wallet_transactions WHERE character_id = ? AND currency = ?',
        [characterId, currency],
      )
      const total = Number(countRows[0]?.total ?? 0)

      const [rows] = await conn.execute<TransactionRow[]>(
        'SELECT * FROM atc_wallet_transactions WHERE character_id = ? AND currency = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [characterId, currency, limit, offset],
      )
      return { transactions: rows.map(rowToTransaction), total }
    } finally {
      conn.release()
    }
  }
}
