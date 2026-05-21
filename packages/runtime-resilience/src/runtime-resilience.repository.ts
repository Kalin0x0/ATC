import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeResiliencePool } from './pool.js'
import { generateId } from './id.js'
import { ResilienceRecordNotFoundError } from './errors.js'

export type AtcResilienceType = 'server' | 'region' | 'cluster' | 'shard' | 'service' | 'custom'
export type AtcResilienceStatus = 'healthy' | 'degraded' | 'critical' | 'recovering' | 'failed'

export interface AtcResilienceRecord {
  id: string
  recordId: string
  resilienceType: AtcResilienceType
  status: AtcResilienceStatus
  ownerServerId: string
  healthScore: number
  resilienceData: Record<string, unknown>
  lastCheckAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertResilienceParams {
  recordId: string
  resilienceType: AtcResilienceType
  ownerServerId: string
  healthScore?: number | undefined
  status?: AtcResilienceStatus | undefined
  resilienceData?: Record<string, unknown> | undefined
}

interface ResilienceRecordRow extends RowDataPacket {
  id: string
  record_id: string
  resilience_type: string
  status: string
  owner_server_id: string
  health_score: number
  resilience_data: string | null
  last_check_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: ResilienceRecordRow): AtcResilienceRecord {
  let resilienceData: Record<string, unknown> = {}
  if (row.resilience_data) {
    try {
      resilienceData = JSON.parse(row.resilience_data) as Record<string, unknown>
    } catch {
      resilienceData = {}
    }
  }
  return {
    id: row.id,
    recordId: row.record_id,
    resilienceType: row.resilience_type as AtcResilienceType,
    status: row.status as AtcResilienceStatus,
    ownerServerId: row.owner_server_id,
    healthScore: row.health_score,
    resilienceData,
    lastCheckAt: row.last_check_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeResilienceRepository {
  constructor(private readonly pool: RuntimeResiliencePool) {}

  async upsert(params: UpsertResilienceParams): Promise<AtcResilienceRecord> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const healthScore = params.healthScore ?? 100
      const status = params.status ?? 'healthy'
      const resilienceDataJson = JSON.stringify(params.resilienceData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_runtime_resilience
           (id, record_id, resilience_type, status, owner_server_id, health_score,
            resilience_data, last_check_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           resilience_type = VALUES(resilience_type),
           status = VALUES(status),
           owner_server_id = VALUES(owner_server_id),
           health_score = VALUES(health_score),
           resilience_data = VALUES(resilience_data),
           last_check_at = NOW(3),
           updated_at = NOW(3)`,
        [
          id,
          params.recordId,
          params.resilienceType,
          status,
          params.ownerServerId,
          healthScore,
          resilienceDataJson,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<ResilienceRecordRow[]>(
        `SELECT id, record_id, resilience_type, status, owner_server_id, health_score,
                resilience_data, last_check_at, created_at, updated_at
         FROM atc_runtime_resilience
         WHERE record_id = ?
         LIMIT 1`,
        [params.recordId]
      )
      if (!rows[0]) throw new Error(`Resilience record not found after upsert: ${params.recordId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcResilienceRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ResilienceRecordRow[]>(
        `SELECT id, record_id, resilience_type, status, owner_server_id, health_score,
                resilience_data, last_check_at, created_at, updated_at
         FROM atc_runtime_resilience
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByRecordId(recordId: string): Promise<AtcResilienceRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ResilienceRecordRow[]>(
        `SELECT id, record_id, resilience_type, status, owner_server_id, health_score,
                resilience_data, last_check_at, created_at, updated_at
         FROM atc_runtime_resilience
         WHERE record_id = ?
         LIMIT 1`,
        [recordId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateHealthScore(
    recordId: string,
    healthScore: number,
    status: AtcResilienceStatus
  ): Promise<AtcResilienceRecord> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ResilienceRecordRow[]>(
          `SELECT id, record_id, resilience_type, status, owner_server_id, health_score,
                  resilience_data, last_check_at, created_at, updated_at
           FROM atc_runtime_resilience
           WHERE record_id = ?
           LIMIT 1
           FOR UPDATE`,
          [recordId]
        )
        if (!lockRows[0]) throw new ResilienceRecordNotFoundError(recordId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_runtime_resilience
           SET health_score = ?, status = ?, last_check_at = NOW(3), updated_at = NOW(3)
           WHERE record_id = ?`,
          [healthScore, status, recordId] as (string | number | boolean | null)[]
        )

        const [rows] = await conn.execute<ResilienceRecordRow[]>(
          `SELECT id, record_id, resilience_type, status, owner_server_id, health_score,
                  resilience_data, last_check_at, created_at, updated_at
           FROM atc_runtime_resilience
           WHERE record_id = ?
           LIMIT 1`,
          [recordId]
        )
        if (!rows[0]) throw new ResilienceRecordNotFoundError(recordId)

        await conn.commit()
        return mapRow(rows[0])
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async listAll(ownerServerId?: string | undefined): Promise<AtcResilienceRecord[]> {
    const conn = await this.pool.getConnection()
    try {
      if (ownerServerId !== undefined) {
        const [rows] = await conn.execute<ResilienceRecordRow[]>(
          `SELECT id, record_id, resilience_type, status, owner_server_id, health_score,
                  resilience_data, last_check_at, created_at, updated_at
           FROM atc_runtime_resilience
           WHERE owner_server_id = ?
           ORDER BY created_at ASC`,
          [ownerServerId]
        )
        return rows.map(mapRow)
      }
      const [rows] = await conn.execute<ResilienceRecordRow[]>(
        `SELECT id, record_id, resilience_type, status, owner_server_id, health_score,
                resilience_data, last_check_at, created_at, updated_at
         FROM atc_runtime_resilience
         ORDER BY created_at ASC`
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }
}
