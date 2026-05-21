import type { RowDataPacket } from 'mysql2/promise'
import type {
  AtcCommerceOrder,
  AtcCommerceOrderPage,
  CommerceOrderType,
  CommerceOrderStatus,
} from '@atc/shared-types'
import type { CommercePool } from './pool.js'

interface OrderRow extends RowDataPacket {
  id: string
  idempotency_key: string
  order_type: string
  status: string
  character_id: string
  shop_id: string
  payer_account_id: string
  payee_account_id: string
  item_id: string
  quantity: number
  unit_price: string
  subtotal_amount: string
  tax_amount: string
  fee_amount: string
  total_amount: string
  currency: string
  journal_id: string | null
  failure_reason: string | null
  created_at: Date
  updated_at: Date
}

function rowToOrder(row: OrderRow): AtcCommerceOrder {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    orderType: row.order_type as CommerceOrderType,
    status: row.status as CommerceOrderStatus,
    characterId: row.character_id,
    shopId: row.shop_id,
    payerAccountId: row.payer_account_id,
    payeeAccountId: row.payee_account_id,
    itemId: row.item_id,
    quantity: row.quantity,
    unitPrice: parseFloat(row.unit_price),
    subtotalAmount: parseFloat(row.subtotal_amount),
    taxAmount: parseFloat(row.tax_amount),
    feeAmount: parseFloat(row.fee_amount),
    totalAmount: parseFloat(row.total_amount),
    currency: row.currency,
    journalId: row.journal_id,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface ListOrdersParams {
  characterId?: string | undefined
  shopId?: string | undefined
  status?: CommerceOrderStatus | undefined
  orderType?: CommerceOrderType | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export class OrderRepository {
  constructor(private readonly pool: CommercePool) {}

  async findById(id: string): Promise<AtcCommerceOrder | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<OrderRow[]>(
        'SELECT * FROM atc_commerce_orders WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToOrder(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByIdempotencyKey(key: string): Promise<AtcCommerceOrder | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<OrderRow[]>(
        'SELECT * FROM atc_commerce_orders WHERE idempotency_key = ? LIMIT 1',
        [key],
      )
      return rows[0] ? rowToOrder(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async list(params: ListOrdersParams = {}): Promise<AtcCommerceOrderPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: string[] = []

    if (params.characterId) { conditions.push('character_id = ?'); args.push(params.characterId) }
    if (params.shopId)      { conditions.push('shop_id = ?');      args.push(params.shopId) }
    if (params.status)      { conditions.push('status = ?');       args.push(params.status) }
    if (params.orderType)   { conditions.push('order_type = ?');   args.push(params.orderType) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_commerce_orders ${where}`,
        args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<OrderRow[]>(
        `SELECT * FROM atc_commerce_orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToOrder), total, offset, limit }
    } finally {
      conn.release()
    }
  }
}
