import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { MarketPool } from './pool.js'
import { generateId } from './id.js'
import { TaxRecordNotFoundError } from './errors.js'

export type AtcTaxType = 'income' | 'property' | 'transaction' | 'import' | 'fine'

export type AtcTaxRecordStatus = 'pending' | 'collected' | 'waived' | 'disputed'

export interface AtcTaxRecord {
  id: string
  principalId: string
  taxType: AtcTaxType
  amount: bigint
  sourceTransactionId: string | null
  periodLabel: string | null
  status: AtcTaxRecordStatus
  collectedAt: Date | null
  createdAt: Date
}

export interface RecordTaxParams {
  principalId: string
  taxType: AtcTaxType
  amount: bigint
  sourceTransactionId?: string | null | undefined
  periodLabel?: string | null | undefined
}

interface TaxRecordRow extends RowDataPacket {
  id: string
  principal_id: string
  tax_type: string
  amount: string
  source_transaction_id: string | null
  period_label: string | null
  status: string
  collected_at: Date | null
  created_at: Date
}

interface SumRow extends RowDataPacket {
  total: string | null
}

function rowToTaxRecord(row: TaxRecordRow): AtcTaxRecord {
  return {
    id: row.id,
    principalId: row.principal_id,
    taxType: row.tax_type as AtcTaxType,
    amount: BigInt(row.amount),
    sourceTransactionId: row.source_transaction_id,
    periodLabel: row.period_label,
    status: row.status as AtcTaxRecordStatus,
    collectedAt: row.collected_at,
    createdAt: row.created_at,
  }
}

export class TaxRecordRepository {
  constructor(private readonly pool: MarketPool) {}

  async record(params: RecordTaxParams): Promise<AtcTaxRecord> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_tax_records
           (id, principal_id, tax_type, amount, source_transaction_id, period_label, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(3))`,
        [
          id,
          params.principalId,
          params.taxType,
          params.amount.toString(),
          params.sourceTransactionId ?? null,
          params.periodLabel ?? null,
        ],
      )
      const [rows] = await conn.execute<TaxRecordRow[]>(
        'SELECT * FROM atc_tax_records WHERE id = ? LIMIT 1',
        [id],
      )
      return rowToTaxRecord(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcTaxRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TaxRecordRow[]>(
        'SELECT * FROM atc_tax_records WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToTaxRecord(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async markCollected(id: string, transactionId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_tax_records
         SET status = 'collected', source_transaction_id = ?, collected_at = NOW(3)
         WHERE id = ?`,
        [transactionId, id],
      )
      if (result.affectedRows === 0) throw new TaxRecordNotFoundError(id)
    } finally {
      conn.release()
    }
  }

  async waive(id: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_tax_records SET status = 'waived' WHERE id = ?`,
        [id],
      )
      if (result.affectedRows === 0) throw new TaxRecordNotFoundError(id)
    } finally {
      conn.release()
    }
  }

  async listPendingByPrincipal(principalId: string): Promise<AtcTaxRecord[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TaxRecordRow[]>(
        `SELECT * FROM atc_tax_records
         WHERE principal_id = ? AND status = 'pending'
         ORDER BY created_at ASC`,
        [principalId],
      )
      return rows.map(rowToTaxRecord)
    } finally {
      conn.release()
    }
  }

  async sumPendingByPrincipal(principalId: string): Promise<bigint> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SumRow[]>(
        `SELECT SUM(amount) AS total FROM atc_tax_records
         WHERE principal_id = ? AND status = 'pending'`,
        [principalId],
      )
      const total = rows[0]?.total
      return total !== null && total !== undefined ? BigInt(total) : 0n
    } finally {
      conn.release()
    }
  }
}
