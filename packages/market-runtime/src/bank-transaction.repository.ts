import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'
import type { MarketPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateTransactionError, TransactionNotFoundError } from './errors.js'

export type AtcBankTransactionType =
  | 'transfer'
  | 'deposit'
  | 'withdrawal'
  | 'tax'
  | 'refund'
  | 'auction_payment'
  | 'marketplace_payment'
  | 'escrow_in'
  | 'escrow_out'

export type AtcBankTransactionStatus = 'pending' | 'completed' | 'failed' | 'reversed'

export interface AtcBankTransaction {
  id: string
  fromAccountId: string | null
  toAccountId: string | null
  transactionType: AtcBankTransactionType
  amount: bigint
  idempotencyKey: string
  description: string | null
  metadata: Record<string, unknown> | null
  status: AtcBankTransactionStatus
  completedAt: Date | null
  failedAt: Date | null
  createdAt: Date
}

export interface RecordTransactionParams {
  fromAccountId: string | null | undefined
  toAccountId: string | null | undefined
  transactionType: AtcBankTransactionType
  amount: bigint
  idempotencyKey: string
  description?: string | null | undefined
  metadata?: Record<string, unknown> | null | undefined
}

interface BankTransactionRow extends RowDataPacket {
  id: string
  from_account_id: string | null
  to_account_id: string | null
  transaction_type: string
  amount: string
  idempotency_key: string
  description: string | null
  metadata: string | null
  status: string
  completed_at: Date | null
  failed_at: Date | null
  created_at: Date
}

function rowToTransaction(row: BankTransactionRow): AtcBankTransaction {
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
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    transactionType: row.transaction_type as AtcBankTransactionType,
    amount: BigInt(row.amount),
    idempotencyKey: row.idempotency_key,
    description: row.description,
    metadata,
    status: row.status as AtcBankTransactionStatus,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
  }
}

export class BankTransactionRepository {
  constructor(private readonly pool: MarketPool) {}

  async record(
    params: RecordTransactionParams,
    conn?: PoolConnection,
  ): Promise<AtcBankTransaction> {
    const ownConn = conn === undefined
    const c = conn ?? (await this.pool.getConnection())
    try {
      const id = generateId()
      const metadataJson =
        params.metadata != null ? JSON.stringify(params.metadata) : null

      try {
        await c.execute<ResultSetHeader>(
          `INSERT INTO atc_bank_transactions
             (id, from_account_id, to_account_id, transaction_type, amount, idempotency_key,
              description, metadata, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(3))`,
          [
            id,
            params.fromAccountId ?? null,
            params.toAccountId ?? null,
            params.transactionType,
            params.amount.toString(),
            params.idempotencyKey,
            params.description ?? null,
            metadataJson,
          ],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateTransactionError(params.idempotencyKey)
        }
        throw err
      }

      const [rows] = await c.execute<BankTransactionRow[]>(
        'SELECT * FROM atc_bank_transactions WHERE id = ? LIMIT 1',
        [id],
      )
      return rowToTransaction(rows[0]!)
    } finally {
      if (ownConn) c.release()
    }
  }

  async findById(id: string): Promise<AtcBankTransaction | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<BankTransactionRow[]>(
        'SELECT * FROM atc_bank_transactions WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToTransaction(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByIdempotencyKey(key: string): Promise<AtcBankTransaction | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<BankTransactionRow[]>(
        'SELECT * FROM atc_bank_transactions WHERE idempotency_key = ? LIMIT 1',
        [key],
      )
      return rows[0] ? rowToTransaction(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async complete(id: string, conn?: PoolConnection): Promise<void> {
    const ownConn = conn === undefined
    const c = conn ?? (await this.pool.getConnection())
    try {
      const [result] = await c.execute<ResultSetHeader>(
        `UPDATE atc_bank_transactions
         SET status = 'completed', completed_at = NOW(3)
         WHERE id = ?`,
        [id],
      )
      if (result.affectedRows === 0) throw new TransactionNotFoundError(id)
    } finally {
      if (ownConn) c.release()
    }
  }

  async fail(id: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_bank_transactions
         SET status = 'failed', failed_at = NOW(3)
         WHERE id = ?`,
        [id],
      )
      if (result.affectedRows === 0) throw new TransactionNotFoundError(id)
    } finally {
      conn.release()
    }
  }

  async listByAccount(
    accountId: string,
    limit: number,
  ): Promise<AtcBankTransaction[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<BankTransactionRow[]>(
        `SELECT * FROM atc_bank_transactions
         WHERE from_account_id = ? OR to_account_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [accountId, accountId, limit],
      )
      return rows.map(rowToTransaction)
    } finally {
      conn.release()
    }
  }

  async listByPrincipal(
    principalId: string,
    limit: number,
  ): Promise<AtcBankTransaction[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<BankTransactionRow[]>(
        `SELECT t.* FROM atc_bank_transactions t
         JOIN atc_bank_accounts a
           ON a.id = t.from_account_id OR a.id = t.to_account_id
         WHERE a.principal_id = ?
         ORDER BY t.created_at DESC
         LIMIT ?`,
        [principalId, limit],
      )
      return rows.map(rowToTransaction)
    } finally {
      conn.release()
    }
  }
}
