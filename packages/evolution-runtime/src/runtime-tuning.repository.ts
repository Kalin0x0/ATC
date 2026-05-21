import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EvolutionRuntimePool } from './pool.js'
import { generateId } from './id.js'

export type AtcTuningType = 'threshold' | 'interval' | 'capacity' | 'priority' | 'weight' | 'custom'
export type AtcTuningStatus = 'active' | 'inactive' | 'superseded'

export interface AtcRuntimeTuning {
  id: string
  entityId: string
  tuningType: AtcTuningType
  status: AtcTuningStatus
  ownerServerId: string
  tuningData: Record<string, unknown>
  appliedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertRuntimeTuningParams {
  entityId: string
  tuningType: AtcTuningType
  ownerServerId: string
  tuningData?: Record<string, unknown> | undefined
}

interface RuntimeTuningRow extends RowDataPacket {
  id: string
  entity_id: string
  tuning_type: string
  status: string
  owner_server_id: string
  tuning_data: string | null
  applied_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeTuningRow): AtcRuntimeTuning {
  let tuningData: Record<string, unknown> = {}
  if (row.tuning_data) {
    try { tuningData = JSON.parse(row.tuning_data) as Record<string, unknown> } catch { tuningData = {} }
  }
  return {
    id: row.id,
    entityId: row.entity_id,
    tuningType: row.tuning_type as AtcTuningType,
    status: row.status as AtcTuningStatus,
    ownerServerId: row.owner_server_id,
    tuningData,
    appliedAt: row.applied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeTuningRepository {
  constructor(private readonly pool: EvolutionRuntimePool) {}

  async upsert(params: UpsertRuntimeTuningParams): Promise<AtcRuntimeTuning> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const tuningDataJson = JSON.stringify(params.tuningData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_runtime_tuning
           (id, entity_id, tuning_type, status, owner_server_id, tuning_data, applied_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           tuning_type = VALUES(tuning_type),
           tuning_data = VALUES(tuning_data),
           status = 'active',
           applied_at = NOW(3),
           updated_at = NOW(3)`,
        [id, params.entityId, params.tuningType, params.ownerServerId, tuningDataJson] as string[],
      )

      const [rows] = await conn.execute<RuntimeTuningRow[]>(
        `SELECT id, entity_id, tuning_type, status, owner_server_id, tuning_data, applied_at, created_at, updated_at
         FROM atc_runtime_tuning WHERE entity_id = ? LIMIT 1`,
        [params.entityId],
      )
      const row = rows[0]
      if (!row) throw new Error(`Runtime tuning not found after upsert: ${params.entityId}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findByEntity(entityId: string): Promise<AtcRuntimeTuning | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeTuningRow[]>(
        `SELECT id, entity_id, tuning_type, status, owner_server_id, tuning_data, applied_at, created_at, updated_at
         FROM atc_runtime_tuning WHERE entity_id = ? LIMIT 1`,
        [entityId],
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_runtime_tuning
         WHERE status IN ('inactive', 'superseded')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
