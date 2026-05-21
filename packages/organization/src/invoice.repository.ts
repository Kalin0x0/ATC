import type { RowDataPacket } from 'mysql2/promise'
import type {
  Invoice,
  InvoicePage,
  InvoicePayment,
  InvoiceStatus,
  InvoicePartyType,
} from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import { generateId } from './id.js'
import type { OrganizationPool } from './pool.js'

interface InvoiceRow extends RowDataPacket {
  id: string
  issuer_id: string
  issuer_type: string
  recipient_id: string
  recipient_type: string
  amount: string // DECIMAL as string
  currency: string
  description: string
  status: string
  due_at: Date | null
  paid_at: Date | null
  cancelled_at: Date | null
  payment_journal_id: string | null
  metadata: string | null
  created_at: Date
  updated_at: Date
}

interface PaymentRow extends RowDataPacket {
  id: string
  invoice_id: string
  amount: string
  currency: string
  journal_id: string
  paid_at: Date
}

function rowToInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    issuerId: row.issuer_id,
    issuerType: row.issuer_type as InvoicePartyType,
    recipientId: row.recipient_id,
    recipientType: row.recipient_type as InvoicePartyType,
    amount: parseFloat(row.amount),
    currency: row.currency,
    description: row.description,
    status: row.status as InvoiceStatus,
    dueAt: row.due_at,
    paidAt: row.paid_at,
    cancelledAt: row.cancelled_at,
    paymentJournalId: row.payment_journal_id,
    metadata: row.metadata ? JSON.parse(row.metadata) as Record<string, unknown> : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToPayment(row: PaymentRow): InvoicePayment {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    amount: parseFloat(row.amount),
    currency: row.currency,
    journalId: row.journal_id,
    paidAt: row.paid_at,
  }
}

export interface CreateInvoiceParams {
  issuerId: string
  issuerType: InvoicePartyType
  recipientId: string
  recipientType: InvoicePartyType
  amount: number
  currency: string
  description: string
  dueAt?: Date | undefined
  metadata?: Record<string, unknown> | undefined
}

export interface ListInvoicesParams {
  issuerId?: string | undefined
  issuerType?: InvoicePartyType | undefined
  recipientId?: string | undefined
  recipientType?: InvoicePartyType | undefined
  status?: InvoiceStatus | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export class InvoiceRepository {
  constructor(
    private readonly pool: OrganizationPool,
    private readonly telemetry?: AtcTelemetryService,
  ) {}

  async create(params: CreateInvoiceParams): Promise<Invoice> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute(
        `INSERT INTO atc_invoices
           (id, issuer_id, issuer_type, recipient_id, recipient_type,
            amount, currency, description, status, due_at, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, NOW(3), NOW(3))`,
        [
          id,
          params.issuerId,
          params.issuerType,
          params.recipientId,
          params.recipientType,
          params.amount.toFixed(4),
          params.currency,
          params.description,
          params.dueAt ?? null,
          params.metadata ? JSON.stringify(params.metadata) : null,
        ],
      )
      this.telemetry?.increment('economy.invoices_issued_total')
      const invoice = await this._findById(conn, id)
      if (!invoice) throw new Error(`Invoice not found after insert: ${id}`)
      return invoice
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<Invoice | null> {
    const conn = await this.pool.getConnection()
    try {
      return await this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async markPaid(invoiceId: string, journalId: string): Promise<Invoice | null> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        // Record payment
        const paymentId = generateId()
        const [invRows] = await conn.execute<InvoiceRow[]>(
          'SELECT * FROM atc_invoices WHERE id = ? AND status = ? FOR UPDATE',
          [invoiceId, 'issued'],
        )
        const inv = invRows[0]
        if (!inv) {
          await conn.rollback()
          return null
        }

        await conn.execute(
          `INSERT INTO atc_invoice_payments (id, invoice_id, amount, currency, journal_id, paid_at)
           VALUES (?, ?, ?, ?, ?, NOW(3))`,
          [paymentId, invoiceId, inv.amount, inv.currency, journalId],
        )

        await conn.execute(
          `UPDATE atc_invoices
           SET status = 'paid', paid_at = NOW(3), payment_journal_id = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [journalId, invoiceId],
        )
        await conn.commit()
        this.telemetry?.increment('economy.invoices_paid_total')
        return this._findById(conn, invoiceId)
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async cancel(invoiceId: string): Promise<Invoice | null> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_invoices
         SET status = 'cancelled', cancelled_at = NOW(3), updated_at = NOW(3)
         WHERE id = ? AND status IN ('draft', 'issued')`,
        [invoiceId],
      )
      return this._findById(conn, invoiceId)
    } finally {
      conn.release()
    }
  }

  async list(params: ListInvoicesParams = {}): Promise<InvoicePage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const filterArgs: string[] = []

    if (params.issuerId)     { conditions.push('issuer_id = ?');     filterArgs.push(params.issuerId) }
    if (params.issuerType)   { conditions.push('issuer_type = ?');   filterArgs.push(params.issuerType) }
    if (params.recipientId)  { conditions.push('recipient_id = ?');  filterArgs.push(params.recipientId) }
    if (params.recipientType){ conditions.push('recipient_type = ?');filterArgs.push(params.recipientType) }
    if (params.status)       { conditions.push('status = ?');        filterArgs.push(params.status) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_invoices ${where}`,
        filterArgs,
      )
      const total = countRows[0]?.total ?? 0

      const [rows] = await conn.execute<InvoiceRow[]>(
        `SELECT * FROM atc_invoices ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...filterArgs, limit, offset],
      )

      return { items: rows.map(rowToInvoice), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  async listPayments(invoiceId: string): Promise<InvoicePayment[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PaymentRow[]>(
        'SELECT * FROM atc_invoice_payments WHERE invoice_id = ? ORDER BY paid_at DESC',
        [invoiceId],
      )
      return rows.map(rowToPayment)
    } finally {
      conn.release()
    }
  }

  private async _findById(
    conn: Awaited<ReturnType<OrganizationPool['getConnection']>>,
    id: string,
  ): Promise<Invoice | null> {
    const [rows] = await conn.execute<InvoiceRow[]>(
      'SELECT * FROM atc_invoices WHERE id = ? LIMIT 1',
      [id],
    )
    return rows[0] ? rowToInvoice(rows[0]) : null
  }
}
