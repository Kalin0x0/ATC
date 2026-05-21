import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeObservabilityPool } from './pool.js'
import { generateId } from './id.js'
import { DiagnosticNotFoundError } from './errors.js'

export type AtcDiagnosticType = 'health_check' | 'performance' | 'connectivity' | 'memory' | 'resource' | 'custom'
export type AtcDiagnosticStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped'

export interface AtcRuntimeDiagnostic {
  id: string
  diagnosticId: string
  diagnosticType: AtcDiagnosticType
  entityId: string | null
  status: AtcDiagnosticStatus
  ownerServerId: string
  diagnosticData: Record<string, unknown>
  startedAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateDiagnosticParams {
  diagnosticType: AtcDiagnosticType
  ownerServerId: string
  entityId?: string | undefined
  diagnosticData?: Record<string, unknown> | undefined
}

interface DiagnosticRow extends RowDataPacket {
  id: string
  diagnostic_id: string
  diagnostic_type: string
  entity_id: string | null
  status: string
  owner_server_id: string
  diagnostic_data: string | null
  started_at: Date
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: DiagnosticRow): AtcRuntimeDiagnostic {
  let diagnosticData: Record<string, unknown> = {}
  if (row.diagnostic_data) {
    try { diagnosticData = JSON.parse(row.diagnostic_data) as Record<string, unknown> } catch { diagnosticData = {} }
  }
  return {
    id: row.id,
    diagnosticId: row.diagnostic_id,
    diagnosticType: row.diagnostic_type as AtcDiagnosticType,
    entityId: row.entity_id,
    status: row.status as AtcDiagnosticStatus,
    ownerServerId: row.owner_server_id,
    diagnosticData,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeDiagnosticsRepository {
  constructor(private readonly pool: RuntimeObservabilityPool) {}

  async create(params: CreateDiagnosticParams): Promise<AtcRuntimeDiagnostic> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const diagnosticId = generateId()
      const diagnosticDataJson = JSON.stringify(params.diagnosticData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_runtime_diagnostics
           (id, diagnostic_id, diagnostic_type, entity_id, status, owner_server_id,
            diagnostic_data, started_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, NOW(3), NULL, NOW(3), NOW(3))`,
        [id, diagnosticId, params.diagnosticType, params.entityId ?? null,
         params.ownerServerId, diagnosticDataJson] as (string | null)[]
      )

      const [rows] = await conn.execute<DiagnosticRow[]>(
        `SELECT id, diagnostic_id, diagnostic_type, entity_id, status, owner_server_id,
                diagnostic_data, started_at, completed_at, created_at, updated_at
         FROM atc_runtime_diagnostics WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Diagnostic not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcDiagnosticStatus,
    completedAt?: Date | undefined
  ): Promise<AtcRuntimeDiagnostic> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<DiagnosticRow[]>(
          `SELECT id, diagnostic_id, diagnostic_type, entity_id, status, owner_server_id,
                  diagnostic_data, started_at, completed_at, created_at, updated_at
           FROM atc_runtime_diagnostics WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new DiagnosticNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_diagnostics SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as string[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_diagnostics SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id]
          )
        }

        const [rows] = await conn.execute<DiagnosticRow[]>(
          `SELECT id, diagnostic_id, diagnostic_type, entity_id, status, owner_server_id,
                  diagnostic_data, started_at, completed_at, created_at, updated_at
           FROM atc_runtime_diagnostics WHERE id = ? LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new DiagnosticNotFoundError(id)
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

  async listByEntity(entityId: string): Promise<AtcRuntimeDiagnostic[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DiagnosticRow[]>(
        `SELECT id, diagnostic_id, diagnostic_type, entity_id, status, owner_server_id,
                diagnostic_data, started_at, completed_at, created_at, updated_at
         FROM atc_runtime_diagnostics WHERE entity_id = ? ORDER BY created_at DESC LIMIT 50`,
        [entityId]
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }
}
