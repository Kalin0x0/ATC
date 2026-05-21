import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { HousingEconomyPool } from './pool.js'
import { generateId } from './id.js'
import { PropertyTaxNotFoundError, PropertyTaxAlreadyPaidError } from './errors.js'

export type AtcTaxStatus = 'assessed' | 'paid' | 'overdue' | 'waived'

export interface AtcPropertyTax {
  id: string
  propertyId: string
  principalId: string
  amount: bigint
  periodLabel: string
  status: AtcTaxStatus
  assessedAt: Date
  dueAt: Date
  paidAt: Date | null
  paidByPrincipalId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AssessTaxParams {
  propertyId: string
  principalId: string
  amount: bigint
  periodLabel: string
  dueAt: Date
}

export interface TransitionTaxOpts {
  paidByPrincipalId?: string | null | undefined
  paidAt?: Date | undefined
}

interface PropertyTaxRow extends RowDataPacket {
  id: string
  property_id: string
  principal_id: string
  amount: string
  period_label: string
  status: string
  assessed_at: Date
  due_at: Date
  paid_at: Date | null
  paid_by_principal_id: string | null
  created_at: Date
  updated_at: Date
}

function rowToPropertyTax(row: PropertyTaxRow): AtcPropertyTax {
  return {
    id: row.id,
    propertyId: row.property_id,
    principalId: row.principal_id,
    amount: BigInt(row.amount),
    periodLabel: row.period_label,
    status: row.status as AtcTaxStatus,
    assessedAt: row.assessed_at,
    dueAt: row.due_at,
    paidAt: row.paid_at,
    paidByPrincipalId: row.paid_by_principal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const ALLOWED_TAX_TRANSITIONS: Record<AtcTaxStatus, AtcTaxStatus[]> = {
  assessed: ['paid', 'overdue', 'waived'],
  overdue: ['paid', 'waived'],
  paid: [],
  waived: [],
}

export class PropertyTaxRepository {
  constructor(private readonly pool: HousingEconomyPool) {}

  async assess(params: AssessTaxParams): Promise<AtcPropertyTax> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_property_taxes
           (id, property_id, principal_id, amount, period_label, status,
            assessed_at, due_at, paid_at, paid_by_principal_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'assessed', NOW(3), ?, NULL, NULL, NOW(3), NOW(3))`,
        [
          id,
          params.propertyId,
          params.principalId,
          params.amount.toString(),
          params.periodLabel,
          params.dueAt,
        ],
      )
      const [rows] = await conn.execute<PropertyTaxRow[]>(
        'SELECT * FROM atc_property_taxes WHERE id = ? LIMIT 1',
        [id],
      )
      if (!rows[0]) throw new PropertyTaxNotFoundError(id)
      return rowToPropertyTax(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcPropertyTax | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PropertyTaxRow[]>(
        'SELECT * FROM atc_property_taxes WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToPropertyTax(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByPropertyAndPeriod(
    propertyId: string,
    periodLabel: string,
  ): Promise<AtcPropertyTax | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PropertyTaxRow[]>(
        'SELECT * FROM atc_property_taxes WHERE property_id = ? AND period_label = ? LIMIT 1',
        [propertyId, periodLabel],
      )
      return rows[0] ? rowToPropertyTax(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async transition(
    id: string,
    status: AtcTaxStatus,
    opts?: TransitionTaxOpts,
  ): Promise<AtcPropertyTax> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      const [rows] = await conn.execute<PropertyTaxRow[]>(
        'SELECT * FROM atc_property_taxes WHERE id = ? FOR UPDATE',
        [id],
      )
      const row = rows[0]
      if (!row) {
        await conn.rollback()
        throw new PropertyTaxNotFoundError(id)
      }

      const current = row.status as AtcTaxStatus
      if (current === 'paid') {
        await conn.rollback()
        throw new PropertyTaxAlreadyPaidError(id)
      }

      const allowed = ALLOWED_TAX_TRANSITIONS[current]
      if (!allowed.includes(status)) {
        await conn.rollback()
        throw new PropertyTaxNotFoundError(id)
      }

      const paidByPrincipalId = opts?.paidByPrincipalId ?? null
      const paidAtExpr = status === 'paid' ? 'NOW(3)' : 'NULL'

      await conn.execute(
        `UPDATE atc_property_taxes
         SET status = ?,
             paid_at = ${paidAtExpr},
             paid_by_principal_id = COALESCE(?, paid_by_principal_id),
             updated_at = NOW(3)
         WHERE id = ?`,
        [status, paidByPrincipalId, id],
      )

      const [updated] = await conn.execute<PropertyTaxRow[]>(
        'SELECT * FROM atc_property_taxes WHERE id = ? LIMIT 1',
        [id],
      )
      await conn.commit()
      return rowToPropertyTax(updated[0]!)
    } catch (err) {
      try { await conn.rollback() } catch { /* ignore */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async listOverdue(): Promise<AtcPropertyTax[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PropertyTaxRow[]>(
        `SELECT * FROM atc_property_taxes
         WHERE status = 'assessed' AND due_at < NOW(3)
         ORDER BY due_at ASC`,
      )
      return rows.map(rowToPropertyTax)
    } finally {
      conn.release()
    }
  }

  async listByProperty(propertyId: string): Promise<AtcPropertyTax[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PropertyTaxRow[]>(
        `SELECT * FROM atc_property_taxes
         WHERE property_id = ?
         ORDER BY assessed_at DESC`,
        [propertyId],
      )
      return rows.map(rowToPropertyTax)
    } finally {
      conn.release()
    }
  }
}
