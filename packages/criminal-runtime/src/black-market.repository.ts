import type { RowDataPacket } from 'mysql2/promise'
import type { AtcBlackMarketTransaction } from '@atc/shared-types'
import type { CriminalPool } from './pool.js'
import { generateId } from './id.js'
import { BlackMarketTransactionNotFoundError } from './errors.js'

interface BlackMarketRow extends RowDataPacket {
  id: string
  seller_principal_id: string
  buyer_principal_id: string
  item_name: string
  quantity: number
  price: number
  location_label: string | null
  completed_at: Date | null
  created_at: Date
}

function rowToTransaction(row: BlackMarketRow): AtcBlackMarketTransaction {
  return {
    id: row.id,
    sellerPrincipalId: row.seller_principal_id,
    buyerPrincipalId: row.buyer_principal_id,
    itemName: row.item_name,
    quantity: row.quantity,
    price: row.price,
    locationLabel: row.location_label,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }
}

export interface RecordTradeParams {
  sellerPrincipalId: string
  buyerPrincipalId: string
  itemName: string
  quantity: number
  price: number
  locationLabel?: string | undefined
}

export class BlackMarketRepository {
  constructor(private readonly pool: CriminalPool) {}

  async record(params: RecordTradeParams): Promise<AtcBlackMarketTransaction> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_black_market_transactions
           (id, seller_principal_id, buyer_principal_id, item_name, quantity, price, location_label, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.sellerPrincipalId,
          params.buyerPrincipalId,
          params.itemName,
          params.quantity,
          params.price,
          params.locationLabel ?? null,
        ],
      )
      const tx = await this._findById(conn, id)
      if (!tx) throw new BlackMarketTransactionNotFoundError(id)
      return tx
    } finally {
      conn.release()
    }
  }

  async complete(id: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_black_market_transactions SET completed_at = NOW(3) WHERE id = ?`,
        [id],
      )
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcBlackMarketTransaction | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async listBySeller(principalId: string, limit = 50): Promise<AtcBlackMarketTransaction[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<BlackMarketRow[]>(
        `SELECT * FROM atc_black_market_transactions
         WHERE seller_principal_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [principalId, limit],
      )
      return rows.map(rowToTransaction)
    } finally {
      conn.release()
    }
  }

  async listByBuyer(principalId: string, limit = 50): Promise<AtcBlackMarketTransaction[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<BlackMarketRow[]>(
        `SELECT * FROM atc_black_market_transactions
         WHERE buyer_principal_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [principalId, limit],
      )
      return rows.map(rowToTransaction)
    } finally {
      conn.release()
    }
  }

  private async _findById(
    conn: Awaited<ReturnType<CriminalPool['getConnection']>>,
    id: string,
  ): Promise<AtcBlackMarketTransaction | null> {
    const [rows] = await conn.execute<BlackMarketRow[]>(
      `SELECT * FROM atc_black_market_transactions WHERE id = ? LIMIT 1`,
      [id],
    )
    return rows[0] ? rowToTransaction(rows[0]) : null
  }
}
