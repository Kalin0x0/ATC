import type { RowDataPacket } from 'mysql2/promise'
import type {
  FinancialAccount,
  FinancialAccountPage,
  FinancialAccountType,
  FinancialAccountStatus,
  FinancialAccountOwnerType,
} from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import { generateId } from './id.js'
import type { LedgerPool } from './pool.js'

interface AccountRow extends RowDataPacket {
  id: string
  owner_type: string
  owner_id: string
  account_type: string
  currency: string
  balance: string // DECIMAL returned as string by mysql2
  balance_version: number
  status: string
  metadata: string | null
  created_at: Date
  updated_at: Date
}

function rowToAccount(row: AccountRow): FinancialAccount {
  return {
    id: row.id,
    ownerType: row.owner_type as FinancialAccountOwnerType,
    ownerId: row.owner_id,
    accountType: row.account_type as FinancialAccountType,
    currency: row.currency,
    balance: parseFloat(row.balance),
    balanceVersion: row.balance_version,
    status: row.status as FinancialAccountStatus,
    metadata: row.metadata ? JSON.parse(row.metadata) as Record<string, string> : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateAccountParams {
  ownerType: FinancialAccountOwnerType
  ownerId: string
  accountType: FinancialAccountType
  currency: string
  metadata?: Record<string, string> | undefined
}

export interface UpdateAccountStatusParams {
  status: FinancialAccountStatus
}

export interface ListAccountsParams {
  ownerType?: FinancialAccountOwnerType | undefined
  ownerId?: string | undefined
  accountType?: FinancialAccountType | undefined
  status?: FinancialAccountStatus | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export class AccountRepository {
  constructor(
    private readonly pool: LedgerPool,
    private readonly telemetry?: AtcTelemetryService,
  ) {}

  async create(params: CreateAccountParams): Promise<FinancialAccount> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute(
        `INSERT INTO atc_financial_accounts
           (id, owner_type, owner_id, account_type, currency, balance, balance_version, status, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0.0000, 0, 'active', ?, NOW(3), NOW(3))`,
        [
          id,
          params.ownerType,
          params.ownerId,
          params.accountType,
          params.currency,
          params.metadata ? JSON.stringify(params.metadata) : null,
        ],
      )
      this.telemetry?.increment('economy.accounts_created_total')
      const account = await this._findById(conn, id)
      if (!account) throw new Error(`Financial account not found after insert: ${id}`)
      return account
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<FinancialAccount | null> {
    const conn = await this.pool.getConnection()
    try {
      return await this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: FinancialAccountStatus): Promise<FinancialAccount | null> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_financial_accounts SET status = ?, updated_at = NOW(3) WHERE id = ?`,
        [status, id],
      )
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async list(params: ListAccountsParams = {}): Promise<FinancialAccountPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const filterArgs: string[] = []

    if (params.ownerType) { conditions.push('owner_type = ?'); filterArgs.push(params.ownerType) }
    if (params.ownerId)   { conditions.push('owner_id = ?');   filterArgs.push(params.ownerId) }
    if (params.accountType) { conditions.push('account_type = ?'); filterArgs.push(params.accountType) }
    if (params.status)    { conditions.push('status = ?');      filterArgs.push(params.status) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_financial_accounts ${where}`,
        filterArgs,
      )
      const total = countRows[0]?.total ?? 0

      const [rows] = await conn.execute<AccountRow[]>(
        `SELECT * FROM atc_financial_accounts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...filterArgs, limit, offset],
      )

      return { items: rows.map(rowToAccount), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  private async _findById(
    conn: Awaited<ReturnType<LedgerPool['getConnection']>>,
    id: string,
  ): Promise<FinancialAccount | null> {
    const [rows] = await conn.execute<AccountRow[]>(
      'SELECT * FROM atc_financial_accounts WHERE id = ? LIMIT 1',
      [id],
    )
    return rows[0] ? rowToAccount(rows[0]) : null
  }
}
