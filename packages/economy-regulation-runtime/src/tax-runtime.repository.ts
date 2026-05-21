import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EconomyRegulationPool } from './pool.js'
import { generateId } from './id.js'

export type AtcTaxType = 'income' | 'sales' | 'property' | 'corporate' | 'import' | 'custom'
export type AtcTaxStatus = 'active' | 'suspended' | 'modified'

export interface AtcTaxRuntime {
  id: string
  regionId: string
  taxType: AtcTaxType
  rate: number
  status: AtcTaxStatus
  ownerServerId: string
  taxData: Record<string, unknown>
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UpsertTaxParams {
  regionId: string
  taxType: AtcTaxType
  rate: number
  ownerServerId: string
  taxData?: Record<string, unknown> | undefined
}

interface TaxRuntimeRow extends RowDataPacket {
  id: string
  region_id: string
  tax_type: AtcTaxType
  rate: string
  status: AtcTaxStatus
  owner_server_id: string
  tax_data: string
  is_active: number | boolean
  created_at: Date
  updated_at: Date
}

function mapRow(row: TaxRuntimeRow): AtcTaxRuntime {
  return {
    id: row.id,
    regionId: row.region_id,
    taxType: row.tax_type,
    rate: parseFloat(row.rate),
    status: row.status,
    ownerServerId: row.owner_server_id,
    taxData: typeof row.tax_data === 'string'
      ? (JSON.parse(row.tax_data) as Record<string, unknown>)
      : (row.tax_data as unknown as Record<string, unknown>),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class TaxRuntimeRepository {
  constructor(private pool: EconomyRegulationPool) {}

  async upsert(params: UpsertTaxParams): Promise<AtcTaxRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const taxData = JSON.stringify(params.taxData ?? {})
      await conn.execute(
        `INSERT INTO atc_tax_runtime
          (id, region_id, tax_type, rate, status, owner_server_id, tax_data, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?, true, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           tax_type = VALUES(tax_type),
           rate = VALUES(rate),
           status = 'active',
           owner_server_id = VALUES(owner_server_id),
           tax_data = VALUES(tax_data),
           is_active = true,
           updated_at = NOW(3)`,
        [id, params.regionId, params.taxType, params.rate, params.ownerServerId, taxData],
      )
      const [rows] = await conn.execute<TaxRuntimeRow[]>(
        'SELECT * FROM atc_tax_runtime WHERE region_id = ?',
        [params.regionId],
      )
      return mapRow(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findByRegion(regionId: string): Promise<AtcTaxRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TaxRuntimeRow[]>(
        'SELECT * FROM atc_tax_runtime WHERE region_id = ?',
        [regionId],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async suspend(regionId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.execute<TaxRuntimeRow[]>(
        'SELECT * FROM atc_tax_runtime WHERE region_id = ? FOR UPDATE',
        [regionId],
      )
      await conn.execute<ResultSetHeader>(
        "UPDATE atc_tax_runtime SET status = 'suspended', updated_at = NOW(3) WHERE region_id = ?",
        [regionId],
      )
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async cleanupExpired(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const threshold = new Date(Date.now() - thresholdMs)
      const [result] = await conn.execute<ResultSetHeader>(
        'DELETE FROM atc_tax_runtime WHERE is_active = false AND updated_at < ?',
        [threshold],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
