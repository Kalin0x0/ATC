import type { RowDataPacket } from 'mysql2/promise'
import type {
  AtcCommerceReceipt,
  AtcCommerceReceiptPage,
  CommerceOrderType,
} from '@atc/shared-types'
import type { CommercePool } from './pool.js'

interface ReceiptRow extends RowDataPacket {
  id: string
  order_id: string
  order_type: string
  character_id: string
  shop_id: string
  item_id: string
  item_name: string | null
  quantity: number
  unit_price: string
  subtotal_amount: string
  tax_amount: string
  fee_amount: string
  total_amount: string
  currency: string
  journal_id: string
  issued_at: Date
}

function rowToReceipt(row: ReceiptRow): AtcCommerceReceipt {
  return {
    id: row.id,
    orderId: row.order_id,
    orderType: row.order_type as CommerceOrderType,
    characterId: row.character_id,
    shopId: row.shop_id,
    itemId: row.item_id,
    itemName: row.item_name,
    quantity: row.quantity,
    unitPrice: parseFloat(row.unit_price),
    subtotalAmount: parseFloat(row.subtotal_amount),
    taxAmount: parseFloat(row.tax_amount),
    feeAmount: parseFloat(row.fee_amount),
    totalAmount: parseFloat(row.total_amount),
    currency: row.currency,
    journalId: row.journal_id,
    issuedAt: row.issued_at,
  }
}

export interface ListReceiptsParams {
  characterId?: string | undefined
  shopId?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export class ReceiptRepository {
  constructor(private readonly pool: CommercePool) {}

  async findById(id: string): Promise<AtcCommerceReceipt | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ReceiptRow[]>(
        'SELECT * FROM atc_commerce_receipts WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToReceipt(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByOrderId(orderId: string): Promise<AtcCommerceReceipt | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ReceiptRow[]>(
        'SELECT * FROM atc_commerce_receipts WHERE order_id = ? LIMIT 1',
        [orderId],
      )
      return rows[0] ? rowToReceipt(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async list(params: ListReceiptsParams = {}): Promise<AtcCommerceReceiptPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: string[] = []

    if (params.characterId) { conditions.push('character_id = ?'); args.push(params.characterId) }
    if (params.shopId)      { conditions.push('shop_id = ?');      args.push(params.shopId) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_commerce_receipts ${where}`,
        args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<ReceiptRow[]>(
        `SELECT * FROM atc_commerce_receipts ${where} ORDER BY issued_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToReceipt), total, offset, limit }
    } finally {
      conn.release()
    }
  }
}
