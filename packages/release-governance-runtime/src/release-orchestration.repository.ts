import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReleaseGovernancePool } from './pool.js'
import { generateId } from './id.js'
import { ReleaseOrchestrationNotFoundError } from './errors.js'

export type AtcOrchestrationType = 'sequential' | 'parallel' | 'staged' | 'gated' | 'custom'
export type AtcOrchestrationStatus = 'active' | 'running' | 'completed' | 'failed'

export interface AtcReleaseOrchestration {
  id: string
  orchestrationId: string
  orchestrationType: AtcOrchestrationType
  status: AtcOrchestrationStatus
  ownerServerId: string
  orchestrationData: Record<string, unknown>
  syncedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface InitiateOrchestrationParams {
  orchestrationId: string
  orchestrationType: AtcOrchestrationType
  ownerServerId: string
  orchestrationData?: Record<string, unknown> | undefined
}

interface ReleaseOrchestrationRow extends RowDataPacket {
  id: string
  orchestration_id: string
  orchestration_type: string
  status: string
  owner_server_id: string
  orchestration_data: string | null
  synced_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: ReleaseOrchestrationRow): AtcReleaseOrchestration {
  let orchestrationData: Record<string, unknown> = {}
  if (row.orchestration_data) {
    try {
      orchestrationData = JSON.parse(row.orchestration_data) as Record<string, unknown>
    } catch {
      orchestrationData = {}
    }
  }
  return {
    id: row.id,
    orchestrationId: row.orchestration_id,
    orchestrationType: row.orchestration_type as AtcOrchestrationType,
    status: row.status as AtcOrchestrationStatus,
    ownerServerId: row.owner_server_id,
    orchestrationData,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ReleaseOrchestrationRepository {
  constructor(private readonly pool: ReleaseGovernancePool) {}

  async upsert(params: InitiateOrchestrationParams): Promise<AtcReleaseOrchestration> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const orchestrationDataJson = JSON.stringify(params.orchestrationData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_release_orchestration
           (id, orchestration_id, orchestration_type, status, owner_server_id,
            orchestration_data, synced_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           orchestration_type = VALUES(orchestration_type),
           status = VALUES(status),
           owner_server_id = VALUES(owner_server_id),
           orchestration_data = VALUES(orchestration_data),
           synced_at = NOW(3),
           updated_at = NOW(3)`,
        [
          id,
          params.orchestrationId,
          params.orchestrationType,
          params.ownerServerId,
          orchestrationDataJson,
        ] as unknown[]
      )

      const [rows] = await conn.execute<ReleaseOrchestrationRow[]>(
        `SELECT id, orchestration_id, orchestration_type, status, owner_server_id,
                orchestration_data, synced_at, created_at, updated_at
         FROM atc_release_orchestration
         WHERE orchestration_id = ?
         LIMIT 1`,
        [params.orchestrationId] as unknown[]
      )
      if (!rows[0]) throw new Error(`Release orchestration not found after upsert: ${params.orchestrationId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByOrchestrationId(orchestrationId: string): Promise<AtcReleaseOrchestration | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ReleaseOrchestrationRow[]>(
        `SELECT id, orchestration_id, orchestration_type, status, owner_server_id,
                orchestration_data, synced_at, created_at, updated_at
         FROM atc_release_orchestration
         WHERE orchestration_id = ?
         LIMIT 1`,
        [orchestrationId] as unknown[]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    orchestrationId: string,
    status: AtcOrchestrationStatus
  ): Promise<AtcReleaseOrchestration> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ReleaseOrchestrationRow[]>(
          `SELECT id, orchestration_id, orchestration_type, status, owner_server_id,
                  orchestration_data, synced_at, created_at, updated_at
           FROM atc_release_orchestration
           WHERE orchestration_id = ?
           LIMIT 1
           FOR UPDATE`,
          [orchestrationId] as unknown[]
        )
        if (!lockRows[0]) throw new ReleaseOrchestrationNotFoundError(orchestrationId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_release_orchestration
           SET status = ?, updated_at = NOW(3)
           WHERE orchestration_id = ?`,
          [status, orchestrationId] as unknown[]
        )

        const [rows] = await conn.execute<ReleaseOrchestrationRow[]>(
          `SELECT id, orchestration_id, orchestration_type, status, owner_server_id,
                  orchestration_data, synced_at, created_at, updated_at
           FROM atc_release_orchestration
           WHERE orchestration_id = ?
           LIMIT 1`,
          [orchestrationId] as unknown[]
        )
        if (!rows[0]) throw new ReleaseOrchestrationNotFoundError(orchestrationId)

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

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_release_orchestration
         WHERE status IN ('failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
