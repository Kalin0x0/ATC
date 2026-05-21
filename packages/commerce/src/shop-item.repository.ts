import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { AtcShopItem } from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import { generateId } from './id.js'
import type { CommercePool } from './pool.js'

interface ShopItemRow extends RowDataPacket {
  id: string
  shop_id: string
  item_id: string
  stock: number
  price: string
  sell_price: string | null
  currency: string
  min_level: number | null
  metadata_json: string | null
  created_at: Date
  updated_at: Date
}

function rowToShopItem(row: ShopItemRow): AtcShopItem {
  return {
    id: row.id,
    shopId: row.shop_id,
    itemId: row.item_id,
    stock: row.stock,
    price: parseFloat(row.price),
    sellPrice: row.sell_price !== null ? parseFloat(row.sell_price) : null,
    currency: row.currency,
    minLevel: row.min_level,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) as Record<string, unknown> : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertShopItemParams {
  shopId: string
  itemId: string
  stock?: number | undefined
  price: number
  sellPrice?: number | null | undefined
  currency: string
  minLevel?: number | null | undefined
  metadata?: Record<string, unknown> | null | undefined
}

export interface UpdateShopItemParams {
  stock?: number | undefined
  price?: number | undefined
  sellPrice?: number | null | undefined
  minLevel?: number | null | undefined
  metadata?: Record<string, unknown> | null | undefined
}

export class ShopItemRepository {
  constructor(
    private readonly pool: CommercePool,
    private readonly telemetry?: AtcTelemetryService,
  ) {}

  async upsert(params: UpsertShopItemParams): Promise<AtcShopItem> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute(
        `INSERT INTO atc_shop_items
           (id, shop_id, item_id, stock, price, sell_price, currency, min_level, metadata_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           stock      = VALUES(stock),
           price      = VALUES(price),
           sell_price = VALUES(sell_price),
           min_level  = VALUES(min_level),
           metadata_json = VALUES(metadata_json),
           updated_at = NOW(3)`,
        [
          id,
          params.shopId,
          params.itemId,
          params.stock ?? -1,
          params.price.toFixed(4),
          params.sellPrice != null ? params.sellPrice.toFixed(4) : null,
          params.currency,
          params.minLevel ?? null,
          params.metadata ? JSON.stringify(params.metadata) : null,
        ],
      )
      const item = await this._findByShopAndItem(conn, params.shopId, params.itemId)
      if (!item) throw new Error(`ShopItem not found after upsert: ${params.shopId}/${params.itemId}`)
      return item
    } finally {
      conn.release()
    }
  }

  async remove(shopId: string, itemId: string): Promise<boolean> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_shop_items WHERE shop_id = ? AND item_id = ?`,
        [shopId, itemId],
      )
      return result.affectedRows > 0
    } finally {
      conn.release()
    }
  }

  async listByShop(shopId: string): Promise<AtcShopItem[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ShopItemRow[]>(
        `SELECT * FROM atc_shop_items WHERE shop_id = ? ORDER BY item_id ASC`,
        [shopId],
      )
      return rows.map(rowToShopItem)
    } finally {
      conn.release()
    }
  }

  async findByShopAndItem(shopId: string, itemId: string): Promise<AtcShopItem | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findByShopAndItem(conn, shopId, itemId)
    } finally {
      conn.release()
    }
  }

  private async _findByShopAndItem(
    conn: Awaited<ReturnType<CommercePool['getConnection']>>,
    shopId: string,
    itemId: string,
  ): Promise<AtcShopItem | null> {
    const [rows] = await conn.execute<ShopItemRow[]>(
      'SELECT * FROM atc_shop_items WHERE shop_id = ? AND item_id = ? LIMIT 1',
      [shopId, itemId],
    )
    return rows[0] ? rowToShopItem(rows[0]) : null
  }
}
