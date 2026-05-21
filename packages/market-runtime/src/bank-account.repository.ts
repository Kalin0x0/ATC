import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'
import type { MarketPool } from './pool.js'
import { generateId } from './id.js'
import {
  BankAccountNotFoundError,
  BankAccountFrozenError,
  InsufficientFundsError,
  NegativeBalanceError,
} from './errors.js'

export type AtcBankAccountType = 'personal' | 'business' | 'government' | 'escrow'

export interface AtcBankAccount {
  id: string
  principalId: string
  accountType: AtcBankAccountType
  balance: bigint
  isFrozen: boolean
  frozenAt: Date | null
  frozenByPrincipalId: string | null
  freezeReason: string | null
  createdAt: Date
  updatedAt: Date
}

interface BankAccountRow extends RowDataPacket {
  id: string
  principal_id: string
  account_type: string
  balance: string
  is_frozen: number
  frozen_at: Date | null
  frozen_by_principal_id: string | null
  freeze_reason: string | null
  created_at: Date
  updated_at: Date
}

function rowToAccount(row: BankAccountRow): AtcBankAccount {
  return {
    id: row.id,
    principalId: row.principal_id,
    accountType: row.account_type as AtcBankAccountType,
    balance: BigInt(row.balance),
    isFrozen: row.is_frozen === 1,
    frozenAt: row.frozen_at,
    frozenByPrincipalId: row.frozen_by_principal_id,
    freezeReason: row.freeze_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class BankAccountRepository {
  constructor(private readonly pool: MarketPool) {}

  async create(
    principalId: string,
    accountType: AtcBankAccountType = 'personal',
  ): Promise<AtcBankAccount> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_bank_accounts
             (id, principal_id, account_type, balance, is_frozen, created_at, updated_at)
           VALUES (?, ?, ?, 0, 0, NOW(3), NOW(3))`,
          [id, principalId, accountType],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          const existing = await this.findByPrincipal(principalId, accountType)
          if (existing) return existing
        }
        throw err
      }

      const [rows] = await conn.execute<BankAccountRow[]>(
        'SELECT * FROM atc_bank_accounts WHERE id = ? LIMIT 1',
        [id],
      )
      return rowToAccount(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findByPrincipal(
    principalId: string,
    accountType?: AtcBankAccountType,
  ): Promise<AtcBankAccount | null> {
    const conn = await this.pool.getConnection()
    try {
      if (accountType !== undefined) {
        const [rows] = await conn.execute<BankAccountRow[]>(
          `SELECT * FROM atc_bank_accounts
           WHERE principal_id = ? AND account_type = ?
           LIMIT 1`,
          [principalId, accountType],
        )
        return rows[0] ? rowToAccount(rows[0]) : null
      }
      const [rows] = await conn.execute<BankAccountRow[]>(
        'SELECT * FROM atc_bank_accounts WHERE principal_id = ? LIMIT 1',
        [principalId],
      )
      return rows[0] ? rowToAccount(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcBankAccount | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<BankAccountRow[]>(
        'SELECT * FROM atc_bank_accounts WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToAccount(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async getBalance(
    principalId: string,
    accountType: AtcBankAccountType = 'personal',
  ): Promise<bigint> {
    const conn = await this.pool.getConnection()
    try {
      interface BalanceRow extends RowDataPacket {
        balance: string
      }
      const [rows] = await conn.execute<BalanceRow[]>(
        'SELECT balance FROM atc_bank_accounts WHERE principal_id = ? AND account_type = ? LIMIT 1',
        [principalId, accountType],
      )
      return rows[0] ? BigInt(rows[0].balance) : 0n
    } finally {
      conn.release()
    }
  }

  async creditBalance(
    id: string,
    amount: bigint,
    conn?: PoolConnection,
  ): Promise<void> {
    const ownConn = conn === undefined
    const c = conn ?? (await this.pool.getConnection())
    try {
      await c.execute(
        'UPDATE atc_bank_accounts SET balance = balance + ? WHERE id = ?',
        [amount.toString(), id],
      )
    } finally {
      if (ownConn) c.release()
    }
  }

  async debitBalance(
    id: string,
    amount: bigint,
    conn?: PoolConnection,
  ): Promise<void> {
    const ownConn = conn === undefined
    const c = conn ?? (await this.pool.getConnection())
    try {
      const [rows] = await c.execute<BankAccountRow[]>(
        'SELECT * FROM atc_bank_accounts WHERE id = ? FOR UPDATE',
        [id],
      )
      const row = rows[0]
      if (!row) throw new BankAccountNotFoundError(id)

      const current = BigInt(row.balance)
      if (current < amount) {
        throw new InsufficientFundsError(
          row.principal_id,
          Number(amount),
          Number(current),
        )
      }

      const newBalance = current - amount
      if (newBalance < 0n) {
        throw new NegativeBalanceError(row.principal_id)
      }

      await c.execute(
        'UPDATE atc_bank_accounts SET balance = ? WHERE id = ?',
        [newBalance.toString(), id],
      )
    } finally {
      if (ownConn) c.release()
    }
  }

  async freeze(
    id: string,
    frozenByPrincipalId: string,
    reason: string,
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_bank_accounts
         SET is_frozen = 1, frozen_at = NOW(3), frozen_by_principal_id = ?, freeze_reason = ?
         WHERE id = ?`,
        [frozenByPrincipalId, reason, id],
      )
      if (result.affectedRows === 0) throw new BankAccountNotFoundError(id)
    } finally {
      conn.release()
    }
  }

  async unfreeze(id: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_bank_accounts
         SET is_frozen = 0, frozen_at = NULL, frozen_by_principal_id = NULL, freeze_reason = NULL
         WHERE id = ?`,
        [id],
      )
      if (result.affectedRows === 0) throw new BankAccountNotFoundError(id)
    } finally {
      conn.release()
    }
  }

  async findByIdForUpdate(
    id: string,
    conn: PoolConnection,
  ): Promise<AtcBankAccount | null> {
    const [rows] = await conn.execute<BankAccountRow[]>(
      'SELECT * FROM atc_bank_accounts WHERE id = ? FOR UPDATE',
      [id],
    )
    return rows[0] ? rowToAccount(rows[0]) : null
  }
}

