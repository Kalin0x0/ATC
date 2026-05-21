import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { AtcShop, ShopType, ShopStatus } from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import { generateId } from './id.js'
import type { CommercePool } from './pool.js'

interface ShopRow extends RowDataPacket {
  id: string
  name: string
  type: string
  status: string
  owner_org_id: string | null
  seller_account_id: string | null
  buyer_account_id: string | null
  currency: string
  metadata_json: string | null
  created_at: Date
  updated_at: Date
}

function rowToShop(row: ShopRow): AtcShop {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ShopType,
    status: row.status as ShopStatus,
    ownerOrgId: row.owner_org_id,
    sellerAccountId: row.seller_account_id,
    buyerAccountId: row.buyer_account_id,
    currency: row.currency,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) as Record<string, unknown> : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateShopParams {
  name: string
  type: ShopType
  ownerOrgId?: string | undefined
  sellerAccountId?: string | undefined
  buyerAccountId?: string | undefined
  currency?: string | undefined
  metadata?: Record<string, unknown> | undefined
}

export interface ListShopsParams {
  type?: ShopType | undefined
  status?: ShopStatus | undefined
  ownerOrgId?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface ShopPage {
  items: AtcShop[]
  total: number
  offset: number
  limit: number
}

export class ShopRepository {
  constructor(
    private readonly pool: CommercePool,
    private readonly telemetry?: AtcTelemetryService,
  ) {}

  async create(params: CreateShopParams): Promise<AtcShop> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute(
        `INSERT INTO atc_shops
           (id, name, type, status, owner_org_id, seller_account_id, buyer_account_id, currency, metadata_json, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [
          id,
          params.name,
          params.type,
          params.ownerOrgId ?? null,
          params.sellerAccountId ?? null,
          params.buyerAccountId ?? null,
          params.currency ?? 'USD',
          params.metadata ? JSON.stringify(params.metadata) : null,
        ],
      )
      this.telemetry?.increment('commerce.shops_created_total')
      const shop = await this._findById(conn, id)
      if (!shop) throw new Error(`Shop not found after insert: ${id}`)
      return shop
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcShop | null> {
    const conn = await this.pool.getConnection()
    try {
      return await this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: ShopStatus): Promise<AtcShop | null> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_shops SET status = ?, updated_at = NOW(3) WHERE id = ?`,
        [status, id],
      )
      if (result.affectedRows === 0) return null
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async list(params: ListShopsParams = {}): Promise<ShopPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: string[] = []

    if (params.type)       { conditions.push('type = ?');         args.push(params.type) }
    if (params.status)     { conditions.push('status = ?');       args.push(params.status) }
    if (params.ownerOrgId) { conditions.push('owner_org_id = ?'); args.push(params.ownerOrgId) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_shops ${where}`,
        args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<ShopRow[]>(
        `SELECT * FROM atc_shops ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToShop), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  private async _findById(
    conn: Awaited<ReturnType<CommercePool['getConnection']>>,
    id: string,
  ): Promise<AtcShop | null> {
    const [rows] = await conn.execute<ShopRow[]>(
      'SELECT * FROM atc_shops WHERE id = ? LIMIT 1',
      [id],
    )
    return rows[0] ? rowToShop(rows[0]) : null
  }
}
