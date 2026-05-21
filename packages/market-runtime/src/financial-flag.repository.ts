import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { MarketPool } from './pool.js'
import { generateId } from './id.js'
import { FinancialFlagNotFoundError } from './errors.js'

export type AtcFinancialFlagType =
  | 'suspicious_transfer'
  | 'velocity_breach'
  | 'structuring'
  | 'large_withdrawal'
  | 'unusual_pattern'
  | 'manual_review'

export type AtcFinancialFlagSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface AtcFinancialFlag {
  id: string
  principalId: string
  flagType: AtcFinancialFlagType
  severity: AtcFinancialFlagSeverity
  amountInvolved: bigint | null
  transactionId: string | null
  description: string
  isResolved: boolean
  resolvedAt: Date | null
  resolvedByPrincipalId: string | null
  createdAt: Date
}

export interface FlagParams {
  principalId: string
  flagType: AtcFinancialFlagType
  severity: AtcFinancialFlagSeverity
  description: string
  amountInvolved?: bigint | null | undefined
  transactionId?: string | null | undefined
}

interface FinancialFlagRow extends RowDataPacket {
  id: string
  principal_id: string
  flag_type: string
  severity: string
  amount_involved: string | null
  transaction_id: string | null
  description: string
  is_resolved: number
  resolved_at: Date | null
  resolved_by_principal_id: string | null
  created_at: Date
}

function rowToFlag(row: FinancialFlagRow): AtcFinancialFlag {
  return {
    id: row.id,
    principalId: row.principal_id,
    flagType: row.flag_type as AtcFinancialFlagType,
    severity: row.severity as AtcFinancialFlagSeverity,
    amountInvolved:
      row.amount_involved !== null ? BigInt(row.amount_involved) : null,
    transactionId: row.transaction_id,
    description: row.description,
    isResolved: row.is_resolved === 1,
    resolvedAt: row.resolved_at,
    resolvedByPrincipalId: row.resolved_by_principal_id,
    createdAt: row.created_at,
  }
}

export class FinancialFlagRepository {
  constructor(private readonly pool: MarketPool) {}

  async flag(params: FlagParams): Promise<AtcFinancialFlag> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_financial_flags
           (id, principal_id, flag_type, severity, amount_involved, transaction_id,
            description, is_resolved, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW(3))`,
        [
          id,
          params.principalId,
          params.flagType,
          params.severity,
          params.amountInvolved != null ? params.amountInvolved.toString() : null,
          params.transactionId ?? null,
          params.description,
        ],
      )
      const [rows] = await conn.execute<FinancialFlagRow[]>(
        'SELECT * FROM atc_financial_flags WHERE id = ? LIMIT 1',
        [id],
      )
      return rowToFlag(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcFinancialFlag | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FinancialFlagRow[]>(
        'SELECT * FROM atc_financial_flags WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToFlag(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async resolve(id: string, resolvedByPrincipalId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_financial_flags
         SET is_resolved = 1, resolved_at = NOW(3), resolved_by_principal_id = ?
         WHERE id = ?`,
        [resolvedByPrincipalId, id],
      )
      if (result.affectedRows === 0) throw new FinancialFlagNotFoundError(id)
    } finally {
      conn.release()
    }
  }

  async listUnresolvedByPrincipal(principalId: string): Promise<AtcFinancialFlag[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FinancialFlagRow[]>(
        `SELECT * FROM atc_financial_flags
         WHERE principal_id = ? AND is_resolved = 0
         ORDER BY created_at DESC`,
        [principalId],
      )
      return rows.map(rowToFlag)
    } finally {
      conn.release()
    }
  }

  async listBySeverity(severity: AtcFinancialFlagSeverity): Promise<AtcFinancialFlag[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FinancialFlagRow[]>(
        `SELECT * FROM atc_financial_flags
         WHERE severity = ? AND is_resolved = 0
         ORDER BY created_at DESC`,
        [severity],
      )
      return rows.map(rowToFlag)
    } finally {
      conn.release()
    }
  }

  async listAllUnresolved(): Promise<AtcFinancialFlag[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FinancialFlagRow[]>(
        `SELECT * FROM atc_financial_flags
         WHERE is_resolved = 0
         ORDER BY created_at DESC`,
      )
      return rows.map(rowToFlag)
    } finally {
      conn.release()
    }
  }
}
