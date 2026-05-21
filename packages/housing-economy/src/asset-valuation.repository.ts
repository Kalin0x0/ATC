import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { HousingEconomyPool } from './pool.js'
import { generateId } from './id.js'
import { AssetValuationNotFoundError } from './errors.js'

export interface AtcAssetValuation {
  id: string
  propertyId: string
  valuedAt: Date
  valuationAmount: bigint
  previousAmount: bigint | null
  valuedByPrincipalId: string | null
  method: string
  notes: string | null
  createdAt: Date
}

export interface RecordValuationParams {
  propertyId: string
  valuationAmount: bigint
  valuedByPrincipalId?: string | null | undefined
  method?: string | undefined
  notes?: string | null | undefined
}

interface AssetValuationRow extends RowDataPacket {
  id: string
  property_id: string
  valued_at: Date
  valuation_amount: string
  previous_amount: string | null
  valued_by_principal_id: string | null
  method: string
  notes: string | null
  created_at: Date
}

function rowToValuation(row: AssetValuationRow): AtcAssetValuation {
  return {
    id: row.id,
    propertyId: row.property_id,
    valuedAt: row.valued_at,
    valuationAmount: BigInt(row.valuation_amount),
    previousAmount: row.previous_amount !== null ? BigInt(row.previous_amount) : null,
    valuedByPrincipalId: row.valued_by_principal_id,
    method: row.method,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export class AssetValuationRepository {
  constructor(private readonly pool: HousingEconomyPool) {}

  async record(params: RecordValuationParams): Promise<AtcAssetValuation> {
    const id = generateId()
    const method = params.method ?? 'manual'
    const valuedByPrincipalId = params.valuedByPrincipalId ?? null
    const notes = params.notes ?? null

    const conn = await this.pool.getConnection()
    try {
      const [latestRows] = await conn.execute<AssetValuationRow[]>(
        `SELECT * FROM atc_asset_valuations
         WHERE property_id = ?
         ORDER BY valued_at DESC
         LIMIT 1`,
        [params.propertyId],
      )
      const previousAmount = latestRows[0]
        ? latestRows[0].valuation_amount
        : null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_asset_valuations
           (id, property_id, valued_at, valuation_amount, previous_amount,
            valued_by_principal_id, method, notes, created_at)
         VALUES (?, ?, NOW(3), ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.propertyId,
          params.valuationAmount.toString(),
          previousAmount,
          valuedByPrincipalId,
          method,
          notes,
        ],
      )

      const [rows] = await conn.execute<AssetValuationRow[]>(
        'SELECT * FROM atc_asset_valuations WHERE id = ? LIMIT 1',
        [id],
      )
      if (!rows[0]) throw new AssetValuationNotFoundError(id)
      return rowToValuation(rows[0])
    } finally {
      conn.release()
    }
  }

  async findLatestByProperty(propertyId: string): Promise<AtcAssetValuation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AssetValuationRow[]>(
        `SELECT * FROM atc_asset_valuations
         WHERE property_id = ?
         ORDER BY valued_at DESC
         LIMIT 1`,
        [propertyId],
      )
      return rows[0] ? rowToValuation(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listByProperty(propertyId: string, limit?: number): Promise<AtcAssetValuation[]> {
    const conn = await this.pool.getConnection()
    try {
      const cap = limit ?? 50
      const [rows] = await conn.execute<AssetValuationRow[]>(
        `SELECT * FROM atc_asset_valuations
         WHERE property_id = ?
         ORDER BY valued_at DESC
         LIMIT ?`,
        [propertyId, cap],
      )
      return rows.map(rowToValuation)
    } finally {
      conn.release()
    }
  }
}
