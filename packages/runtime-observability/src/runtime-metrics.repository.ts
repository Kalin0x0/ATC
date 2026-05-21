import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeObservabilityPool } from './pool.js'
import { generateId } from './id.js'

export interface AtcRuntimeMetric {
  id: string
  metricId: string
  metricType: string
  entityId: string | null
  ownerServerId: string
  value: number
  unit: string | null
  metricData: Record<string, unknown>
  recordedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface RecordMetricParams {
  metricType: string
  ownerServerId: string
  value: number
  entityId?: string | undefined
  unit?: string | undefined
  metricData?: Record<string, unknown> | undefined
}

interface MetricRow extends RowDataPacket {
  id: string
  metric_id: string
  metric_type: string
  entity_id: string | null
  owner_server_id: string
  value: number
  unit: string | null
  metric_data: string | null
  recorded_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: MetricRow): AtcRuntimeMetric {
  let metricData: Record<string, unknown> = {}
  if (row.metric_data) {
    try { metricData = JSON.parse(row.metric_data) as Record<string, unknown> } catch { metricData = {} }
  }
  return {
    id: row.id,
    metricId: row.metric_id,
    metricType: row.metric_type,
    entityId: row.entity_id,
    ownerServerId: row.owner_server_id,
    value: row.value,
    unit: row.unit,
    metricData,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeMetricsRepository {
  constructor(private readonly pool: RuntimeObservabilityPool) {}

  async record(params: RecordMetricParams): Promise<AtcRuntimeMetric> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const metricId = generateId()
      const metricDataJson = JSON.stringify(params.metricData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_runtime_metrics
           (id, metric_id, metric_type, entity_id, owner_server_id, value, unit, metric_data, recorded_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))`,
        [id, metricId, params.metricType, params.entityId ?? null, params.ownerServerId,
         params.value, params.unit ?? null, metricDataJson] as (string | number | null)[]
      )

      const [rows] = await conn.execute<MetricRow[]>(
        `SELECT id, metric_id, metric_type, entity_id, owner_server_id, value, unit,
                metric_data, recorded_at, created_at, updated_at
         FROM atc_runtime_metrics WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Metric not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async listByEntity(entityId: string): Promise<AtcRuntimeMetric[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MetricRow[]>(
        `SELECT id, metric_id, metric_type, entity_id, owner_server_id, value, unit,
                metric_data, recorded_at, created_at, updated_at
         FROM atc_runtime_metrics WHERE entity_id = ? ORDER BY recorded_at DESC LIMIT 100`,
        [entityId]
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async cleanupOld(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_runtime_metrics
         WHERE recorded_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
