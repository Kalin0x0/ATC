import type { RowDataPacket } from 'mysql2/promise'
import type { CityRuntimePool } from './pool.js'
import { generateId } from './id.js'

export type AtcResourceType = 'power_kwh' | 'water_liters' | 'gas_m3' | 'bandwidth_mb'

export interface AtcResourceConsumption {
  id: string
  gridId: string
  resourceType: AtcResourceType
  amount: number
  consumerId: string | null
  periodLabel: string
  recordedAt: Date
  createdAt: Date
}

interface ConsumptionRow extends RowDataPacket {
  id: string
  grid_id: string
  resource_type: string
  amount: number
  consumer_id: string | null
  period_label: string
  recorded_at: Date
  created_at: Date
}

function rowToConsumption(row: ConsumptionRow): AtcResourceConsumption {
  return {
    id: row.id,
    gridId: row.grid_id,
    resourceType: row.resource_type as AtcResourceType,
    amount: Number(row.amount),
    consumerId: row.consumer_id,
    periodLabel: row.period_label,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  }
}

export class ResourceConsumptionRepository {
  constructor(private readonly pool: CityRuntimePool) {}

  async record(
    gridId: string,
    resourceType: AtcResourceType,
    amount: number,
    consumerId?: string | undefined,
    periodLabel?: string | undefined,
  ): Promise<AtcResourceConsumption> {
    const id = generateId()
    const label = periodLabel ?? new Date().toISOString().slice(0, 13) // YYYY-MM-DDTHH
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_resource_consumption
           (id, grid_id, resource_type, amount, consumer_id, period_label, recorded_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [id, gridId, resourceType, amount, consumerId ?? null, label],
      )
      const [rows] = await conn.execute<ConsumptionRow[]>(
        `SELECT * FROM atc_resource_consumption WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new Error(`Resource consumption record not found after insert: ${id}`)
      return rowToConsumption(row)
    } finally {
      conn.release()
    }
  }

  async listByGrid(gridId: string, limit?: number | undefined): Promise<AtcResourceConsumption[]> {
    const conn = await this.pool.getConnection()
    try {
      const effectiveLimit = limit ?? 100
      const [rows] = await conn.execute<ConsumptionRow[]>(
        `SELECT * FROM atc_resource_consumption
         WHERE grid_id = ?
         ORDER BY recorded_at DESC
         LIMIT ?`,
        [gridId, effectiveLimit],
      )
      return rows.map(rowToConsumption)
    } finally {
      conn.release()
    }
  }

  async getTotalByGridAndPeriod(gridId: string, periodLabel: string): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM atc_resource_consumption
         WHERE grid_id = ? AND period_label = ?`,
        [gridId, periodLabel],
      )
      const row = rows[0]
      return row ? Number(row.total) : 0
    } finally {
      conn.release()
    }
  }
}
