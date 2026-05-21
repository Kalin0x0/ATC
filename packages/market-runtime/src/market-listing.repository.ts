import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'
import type { MarketPool } from './pool.js'
import { generateId } from './id.js'
import {
  ListingNotFoundError,
  ListingExpiredError,
  ListingAlreadySoldError,
} from './errors.js'

export type AtcMarketListingStatus = 'active' | 'sold' | 'cancelled' | 'expired'

export interface AtcMarketListing {
  id: string
  sellerPrincipalId: string
  itemName: string
  itemCategory: string | null
  quantity: number
  pricePerUnit: bigint
  totalPrice: bigint
  description: string | null
  status: AtcMarketListingStatus
  listingNonce: string
  buyerPrincipalId: string | null
  soldAt: Date | null
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface CreateListingParams {
  sellerPrincipalId: string
  itemName: string
  itemCategory?: string | null | undefined
  quantity: number
  pricePerUnit: bigint
  description?: string | null | undefined
  listingNonce: string
  expiresAt: Date
}

interface MarketListingRow extends RowDataPacket {
  id: string
  seller_principal_id: string
  item_name: string
  item_category: string | null
  quantity: number
  price_per_unit: string
  total_price: string
  description: string | null
  status: string
  listing_nonce: string
  buyer_principal_id: string | null
  sold_at: Date | null
  expires_at: Date
  created_at: Date
  updated_at: Date
}

function rowToListing(row: MarketListingRow): AtcMarketListing {
  return {
    id: row.id,
    sellerPrincipalId: row.seller_principal_id,
    itemName: row.item_name,
    itemCategory: row.item_category,
    quantity: row.quantity,
    pricePerUnit: BigInt(row.price_per_unit),
    totalPrice: BigInt(row.total_price),
    description: row.description,
    status: row.status as AtcMarketListingStatus,
    listingNonce: row.listing_nonce,
    buyerPrincipalId: row.buyer_principal_id,
    soldAt: row.sold_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class MarketListingRepository {
  constructor(private readonly pool: MarketPool) {}

  async create(params: CreateListingParams): Promise<AtcMarketListing> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const totalPrice = params.pricePerUnit * BigInt(params.quantity)

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_market_listings
             (id, seller_principal_id, item_name, item_category, quantity,
              price_per_unit, total_price, description, status, listing_nonce,
              expires_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NOW(3), NOW(3))`,
          [
            id,
            params.sellerPrincipalId,
            params.itemName,
            params.itemCategory ?? null,
            params.quantity,
            params.pricePerUnit.toString(),
            totalPrice.toString(),
            params.description ?? null,
            params.listingNonce,
            params.expiresAt,
          ],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          const existing = await this.findByNonce(
            params.sellerPrincipalId,
            params.listingNonce,
          )
          if (existing) return existing
          throw new ListingAlreadySoldError(params.listingNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<MarketListingRow[]>(
        'SELECT * FROM atc_market_listings WHERE id = ? LIMIT 1',
        [id],
      )
      return rowToListing(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findByNonce(
    sellerPrincipalId: string,
    listingNonce: string,
  ): Promise<AtcMarketListing | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MarketListingRow[]>(
        'SELECT * FROM atc_market_listings WHERE seller_principal_id = ? AND listing_nonce = ? LIMIT 1',
        [sellerPrincipalId, listingNonce],
      )
      return rows[0] ? rowToListing(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcMarketListing | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MarketListingRow[]>(
        'SELECT * FROM atc_market_listings WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToListing(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async purchase(
    id: string,
    buyerPrincipalId: string,
    conn?: PoolConnection,
  ): Promise<AtcMarketListing> {
    const ownConn = conn === undefined
    const c = conn ?? (await this.pool.getConnection())
    try {
      const [rows] = await c.execute<MarketListingRow[]>(
        'SELECT * FROM atc_market_listings WHERE id = ? FOR UPDATE',
        [id],
      )
      const row = rows[0]
      if (!row) throw new ListingNotFoundError(id)

      if (row.status !== 'active') throw new ListingAlreadySoldError(id)
      if (new Date(row.expires_at) < new Date()) throw new ListingExpiredError(id)

      await c.execute<ResultSetHeader>(
        `UPDATE atc_market_listings
         SET status = 'sold', buyer_principal_id = ?, sold_at = NOW(3)
         WHERE id = ?`,
        [buyerPrincipalId, id],
      )

      const [updated] = await c.execute<MarketListingRow[]>(
        'SELECT * FROM atc_market_listings WHERE id = ? LIMIT 1',
        [id],
      )
      return rowToListing(updated[0]!)
    } finally {
      if (ownConn) c.release()
    }
  }

  async cancel(id: string, sellerPrincipalId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_market_listings
         SET status = 'cancelled'
         WHERE id = ? AND seller_principal_id = ? AND status = 'active'`,
        [id, sellerPrincipalId],
      )
      if (result.affectedRows === 0) throw new ListingNotFoundError(id)
    } finally {
      conn.release()
    }
  }

  async listActive(limit: number, offset: number): Promise<AtcMarketListing[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MarketListingRow[]>(
        `SELECT * FROM atc_market_listings
         WHERE status = 'active' AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset],
      )
      return rows.map(rowToListing)
    } finally {
      conn.release()
    }
  }

  async listBySeller(sellerPrincipalId: string): Promise<AtcMarketListing[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MarketListingRow[]>(
        `SELECT * FROM atc_market_listings
         WHERE seller_principal_id = ?
         ORDER BY created_at DESC`,
        [sellerPrincipalId],
      )
      return rows.map(rowToListing)
    } finally {
      conn.release()
    }
  }

  async pruneExpired(): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_market_listings
         SET status = 'expired'
         WHERE expires_at < NOW() AND status = 'active'`,
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
