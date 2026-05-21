import type { RowDataPacket } from 'mysql2/promise'
import type { AtcTaxRule, TaxRuleType, TaxRuleCategory, ShopType } from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import { generateId } from './id.js'
import type { CommercePool } from './pool.js'

interface TaxRuleRow extends RowDataPacket {
  id: string
  name: string
  category: string
  type: string
  rate: string
  currency: string | null
  applies_to_shop_type: string | null
  target_account_id: string
  is_active: number
  created_at: Date
}

function rowToTaxRule(row: TaxRuleRow): AtcTaxRule {
  return {
    id: row.id,
    name: row.name,
    category: row.category as TaxRuleCategory,
    type: row.type as TaxRuleType,
    rate: parseFloat(row.rate),
    currency: row.currency,
    appliesToShopType: row.applies_to_shop_type as ShopType | null,
    targetAccountId: row.target_account_id,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  }
}

export interface CreateTaxRuleParams {
  name: string
  category: TaxRuleCategory
  type: TaxRuleType
  rate: number
  currency?: string | undefined
  appliesToShopType?: ShopType | undefined
  targetAccountId: string
}

export class TaxRuleRepository {
  constructor(
    private readonly pool: CommercePool,
    private readonly telemetry?: AtcTelemetryService,
  ) {}

  async create(params: CreateTaxRuleParams): Promise<AtcTaxRule> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute(
        `INSERT INTO atc_tax_rules
           (id, name, category, type, rate, currency, applies_to_shop_type, target_account_id, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(3))`,
        [
          id,
          params.name,
          params.category,
          params.type,
          params.rate.toFixed(4),
          params.currency ?? null,
          params.appliesToShopType ?? null,
          params.targetAccountId,
        ],
      )
      const rule = await this.findById(id)
      if (!rule) throw new Error(`TaxRule not found after insert: ${id}`)
      return rule
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcTaxRule | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TaxRuleRow[]>(
        'SELECT * FROM atc_tax_rules WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToTaxRule(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  /**
   * Fetch all active rules applicable to a given currency and shop type.
   * Rules with null currency/shop_type match everything.
   */
  async findActive(currency: string, shopType: ShopType): Promise<AtcTaxRule[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TaxRuleRow[]>(
        `SELECT * FROM atc_tax_rules
         WHERE is_active = 1
           AND (currency IS NULL OR currency = ?)
           AND (applies_to_shop_type IS NULL OR applies_to_shop_type = ?)
         ORDER BY category ASC, name ASC`,
        [currency, shopType],
      )
      return rows.map(rowToTaxRule)
    } finally {
      conn.release()
    }
  }

  async setActive(id: string, isActive: boolean): Promise<boolean> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<import('mysql2/promise').ResultSetHeader>(
        `UPDATE atc_tax_rules SET is_active = ? WHERE id = ?`,
        [isActive ? 1 : 0, id],
      )
      return result.affectedRows > 0
    } finally {
      conn.release()
    }
  }

  async list(): Promise<AtcTaxRule[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TaxRuleRow[]>(
        `SELECT * FROM atc_tax_rules ORDER BY category ASC, name ASC`,
      )
      return rows.map(rowToTaxRule)
    } finally {
      conn.release()
    }
  }
}
