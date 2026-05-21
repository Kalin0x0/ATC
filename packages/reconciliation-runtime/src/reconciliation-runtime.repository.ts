import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReconciliationRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { ReconciliationNotFoundError } from './errors.js'

export type AtcReconciliationType =
  | 'ownership'
  | 'snapshot'
  | 'migration'
  | 'consistency'
  | 'custom'

export type AtcReconciliationStatus = 'running' | 'completed' | 'failed'

export interface AtcReconciliationRuntime {
  id: string
  reconciliationId: string
  regionId: string | null
  serverId: string | null
  reconciliationType: AtcReconciliationType
  status: AtcReconciliationStatus
  issuesFound: number
  issuesResolved: number
  lastRunAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertReconciliationParams {
  reconciliationId: string
  reconciliationType: AtcReconciliationType
  regionId?: string | undefined
  serverId?: string | undefined
  issuesFound?: number | undefined
  issuesResolved?: number | undefined
}

interface ReconciliationRuntimeRow extends RowDataPacket {
  id: string
  reconciliation_id: string
  region_id: string | null
  server_id: string | null
  reconciliation_type: string
  status: string
  issues_found: number
  issues_resolved: number
  last_run_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: ReconciliationRuntimeRow): AtcReconciliationRuntime {
  return {
    id: row.id,
    reconciliationId: row.reconciliation_id,
    regionId: row.region_id,
    serverId: row.server_id,
    reconciliationType: row.reconciliation_type as AtcReconciliationType,
    status: row.status as AtcReconciliationStatus,
    issuesFound: row.issues_found,
    issuesResolved: row.issues_resolved,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ReconciliationRuntimeRepository {
  constructor(private readonly pool: ReconciliationRuntimePool) {}

  async findById(reconciliationId: string): Promise<AtcReconciliationRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ReconciliationRuntimeRow[]>(
        `SELECT id, reconciliation_id, region_id, server_id, reconciliation_type,
                status, issues_found, issues_resolved, last_run_at, created_at, updated_at
         FROM atc_reconciliation_runtime
         WHERE reconciliation_id = ?
         LIMIT 1`,
        [reconciliationId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async upsert(params: UpsertReconciliationParams): Promise<AtcReconciliationRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const issuesFound = params.issuesFound ?? 0
      const issuesResolved = params.issuesResolved ?? 0

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_reconciliation_runtime
           (id, reconciliation_id, region_id, server_id, reconciliation_type,
            status, issues_found, issues_resolved, last_run_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'running', ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           reconciliation_type = VALUES(reconciliation_type),
           region_id = VALUES(region_id),
           server_id = VALUES(server_id),
           status = 'running',
           issues_found = VALUES(issues_found),
           issues_resolved = VALUES(issues_resolved),
           last_run_at = NOW(3),
           updated_at = NOW(3)`,
        [
          id,
          params.reconciliationId,
          params.regionId ?? null,
          params.serverId ?? null,
          params.reconciliationType,
          issuesFound,
          issuesResolved,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<ReconciliationRuntimeRow[]>(
        `SELECT id, reconciliation_id, region_id, server_id, reconciliation_type,
                status, issues_found, issues_resolved, last_run_at, created_at, updated_at
         FROM atc_reconciliation_runtime
         WHERE reconciliation_id = ?
         LIMIT 1`,
        [params.reconciliationId]
      )
      if (!rows[0]) throw new Error(`Reconciliation not found after upsert: ${params.reconciliationId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcReconciliationRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ReconciliationRuntimeRow[]>(
        `SELECT id, reconciliation_id, region_id, server_id, reconciliation_type,
                status, issues_found, issues_resolved, last_run_at, created_at, updated_at
         FROM atc_reconciliation_runtime
         WHERE status = 'running'
         ORDER BY last_run_at ASC`
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async complete(
    reconciliationId: string,
    issuesFound: number,
    issuesResolved: number
  ): Promise<AtcReconciliationRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<ReconciliationRuntimeRow[]>(
          `SELECT id, reconciliation_id, region_id, server_id, reconciliation_type,
                  status, issues_found, issues_resolved, last_run_at, created_at, updated_at
           FROM atc_reconciliation_runtime
           WHERE reconciliation_id = ?
           LIMIT 1
           FOR UPDATE`,
          [reconciliationId]
        )
        if (!rows[0]) throw new ReconciliationNotFoundError(reconciliationId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_reconciliation_runtime
           SET status = 'completed', issues_found = ?, issues_resolved = ?,
               last_run_at = NOW(3), updated_at = NOW(3)
           WHERE reconciliation_id = ?`,
          [issuesFound, issuesResolved, reconciliationId] as (string | number | boolean | null)[]
        )

        const [updated] = await conn.execute<ReconciliationRuntimeRow[]>(
          `SELECT id, reconciliation_id, region_id, server_id, reconciliation_type,
                  status, issues_found, issues_resolved, last_run_at, created_at, updated_at
           FROM atc_reconciliation_runtime
           WHERE reconciliation_id = ?
           LIMIT 1`,
          [reconciliationId]
        )
        if (!updated[0]) throw new ReconciliationNotFoundError(reconciliationId)

        await conn.commit()
        return mapRow(updated[0])
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }
}
