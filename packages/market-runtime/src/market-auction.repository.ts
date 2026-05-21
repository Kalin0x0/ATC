import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'
import type { MarketPool } from './pool.js'
import { generateId } from './id.js'
import {
  AuctionNotFoundError,
  AuctionEndedError,
  AuctionBidTooLowError,
} from './errors.js'

export type AtcMarketAuctionStatus = 'active' | 'completed' | 'cancelled' | 'no_sale'

export interface AtcMarketAuction {
  id: string
  sellerPrincipalId: string
  itemName: string
  itemCategory: string | null
  quantity: number
  startingBid: bigint
  minimumBidIncrement: bigint
  currentBid: bigint
  currentBidderPrincipalId: string | null
  reservePrice: bigint | null
  status: AtcMarketAuctionStatus
  auctionNonce: string
  endsAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateAuctionParams {
  sellerPrincipalId: string
  itemName: string
  itemCategory?: string | null | undefined
  quantity: number
  startingBid: bigint
  minimumBidIncrement?: bigint | undefined
  reservePrice?: bigint | null | undefined
  auctionNonce: string
  endsAt: Date
}

interface MarketAuctionRow extends RowDataPacket {
  id: string
  seller_principal_id: string
  item_name: string
  item_category: string | null
  quantity: number
  starting_bid: string
  minimum_bid_increment: string
  current_bid: string
  current_bidder_principal_id: string | null
  reserve_price: string | null
  status: string
  auction_nonce: string
  ends_at: Date
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToAuction(row: MarketAuctionRow): AtcMarketAuction {
  return {
    id: row.id,
    sellerPrincipalId: row.seller_principal_id,
    itemName: row.item_name,
    itemCategory: row.item_category,
    quantity: row.quantity,
    startingBid: BigInt(row.starting_bid),
    minimumBidIncrement: BigInt(row.minimum_bid_increment),
    currentBid: BigInt(row.current_bid),
    currentBidderPrincipalId: row.current_bidder_principal_id,
    reservePrice: row.reserve_price !== null ? BigInt(row.reserve_price) : null,
    status: row.status as AtcMarketAuctionStatus,
    auctionNonce: row.auction_nonce,
    endsAt: row.ends_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class MarketAuctionRepository {
  constructor(private readonly pool: MarketPool) {}

  async create(params: CreateAuctionParams): Promise<AtcMarketAuction> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const minimumBidIncrement = params.minimumBidIncrement ?? 100n

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_market_auctions
             (id, seller_principal_id, item_name, item_category, quantity,
              starting_bid, minimum_bid_increment, current_bid,
              reserve_price, status, auction_nonce, ends_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'active', ?, ?, NOW(3), NOW(3))`,
          [
            id,
            params.sellerPrincipalId,
            params.itemName,
            params.itemCategory ?? null,
            params.quantity,
            params.startingBid.toString(),
            minimumBidIncrement.toString(),
            params.reservePrice != null ? params.reservePrice.toString() : null,
            params.auctionNonce,
            params.endsAt,
          ],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          const existing = await this.findByNonce(
            params.sellerPrincipalId,
            params.auctionNonce,
          )
          if (existing) return existing
        }
        throw err
      }

      const [rows] = await conn.execute<MarketAuctionRow[]>(
        'SELECT * FROM atc_market_auctions WHERE id = ? LIMIT 1',
        [id],
      )
      return rowToAuction(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findByNonce(
    sellerPrincipalId: string,
    auctionNonce: string,
  ): Promise<AtcMarketAuction | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MarketAuctionRow[]>(
        'SELECT * FROM atc_market_auctions WHERE seller_principal_id = ? AND auction_nonce = ? LIMIT 1',
        [sellerPrincipalId, auctionNonce],
      )
      return rows[0] ? rowToAuction(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcMarketAuction | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MarketAuctionRow[]>(
        'SELECT * FROM atc_market_auctions WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToAuction(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async placeBid(
    id: string,
    bidderPrincipalId: string,
    bidAmount: bigint,
    conn?: PoolConnection,
  ): Promise<AtcMarketAuction> {
    const ownConn = conn === undefined
    const c = conn ?? (await this.pool.getConnection())
    try {
      const [rows] = await c.execute<MarketAuctionRow[]>(
        'SELECT * FROM atc_market_auctions WHERE id = ? FOR UPDATE',
        [id],
      )
      const row = rows[0]
      if (!row) throw new AuctionNotFoundError(id)
      if (row.status !== 'active') throw new AuctionEndedError(id)
      if (new Date(row.ends_at) < new Date()) throw new AuctionEndedError(id)

      const currentBid = BigInt(row.current_bid)
      const startingBid = BigInt(row.starting_bid)
      const increment = BigInt(row.minimum_bid_increment)

      const minimumRequired =
        currentBid > 0n ? currentBid + increment : startingBid

      if (bidAmount < minimumRequired) {
        throw new AuctionBidTooLowError(id, Number(minimumRequired), Number(bidAmount))
      }

      await c.execute<ResultSetHeader>(
        `UPDATE atc_market_auctions
         SET current_bid = ?, current_bidder_principal_id = ?
         WHERE id = ?`,
        [bidAmount.toString(), bidderPrincipalId, id],
      )

      const [updated] = await c.execute<MarketAuctionRow[]>(
        'SELECT * FROM atc_market_auctions WHERE id = ? LIMIT 1',
        [id],
      )
      return rowToAuction(updated[0]!)
    } finally {
      if (ownConn) c.release()
    }
  }

  async complete(id: string, conn?: PoolConnection): Promise<AtcMarketAuction> {
    const ownConn = conn === undefined
    const c = conn ?? (await this.pool.getConnection())
    try {
      const [rows] = await c.execute<MarketAuctionRow[]>(
        'SELECT * FROM atc_market_auctions WHERE id = ? FOR UPDATE',
        [id],
      )
      const row = rows[0]
      if (!row) throw new AuctionNotFoundError(id)

      const currentBid = BigInt(row.current_bid)
      const reservePrice = row.reserve_price !== null ? BigInt(row.reserve_price) : null

      const hasBidder = row.current_bidder_principal_id !== null
      const meetsReserve =
        reservePrice === null || (hasBidder && currentBid >= reservePrice)

      const newStatus: AtcMarketAuctionStatus =
        hasBidder && meetsReserve ? 'completed' : 'no_sale'

      await c.execute<ResultSetHeader>(
        `UPDATE atc_market_auctions
         SET status = ?, completed_at = NOW(3)
         WHERE id = ?`,
        [newStatus, id],
      )

      const [updated] = await c.execute<MarketAuctionRow[]>(
        'SELECT * FROM atc_market_auctions WHERE id = ? LIMIT 1',
        [id],
      )
      return rowToAuction(updated[0]!)
    } finally {
      if (ownConn) c.release()
    }
  }

  async cancel(id: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_market_auctions SET status = 'cancelled' WHERE id = ? AND status = 'active'`,
        [id],
      )
      if (result.affectedRows === 0) throw new AuctionNotFoundError(id)
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcMarketAuction[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MarketAuctionRow[]>(
        `SELECT * FROM atc_market_auctions
         WHERE status = 'active' AND ends_at > NOW()
         ORDER BY ends_at ASC`,
      )
      return rows.map(rowToAuction)
    } finally {
      conn.release()
    }
  }

  async listExpiredUnprocessed(): Promise<AtcMarketAuction[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MarketAuctionRow[]>(
        `SELECT * FROM atc_market_auctions
         WHERE status = 'active' AND ends_at < NOW()
         ORDER BY ends_at ASC`,
      )
      return rows.map(rowToAuction)
    } finally {
      conn.release()
    }
  }
}
