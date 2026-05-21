import type { RowDataPacket } from 'mysql2/promise'
import type { AtcMedicalReport } from '@atc/shared-types'
import type { MedicalPool } from './pool.js'
import { generateId } from './id.js'
import { MedicalReportNotFoundError, MedicalReportClosedError } from './errors.js'

interface ReportRow extends RowDataPacket {
  id: string
  character_id: string
  created_by_principal_id: string
  incident_id: string | null
  arrest_id: string | null
  diagnosis: string
  notes: string
  injury_ids: string
  treatment_ids: string
  vitals_snapshot: string | null
  closed_at: Date | null
  closed_by_principal_id: string | null
  created_at: Date
  updated_at: Date
}

function rowToReport(row: ReportRow): AtcMedicalReport {
  return {
    id: row.id,
    characterId: row.character_id,
    createdByPrincipalId: row.created_by_principal_id,
    incidentId: row.incident_id,
    arrestId: row.arrest_id,
    diagnosis: row.diagnosis,
    notes: row.notes,
    injuryIds: JSON.parse(row.injury_ids) as string[],
    treatmentIds: JSON.parse(row.treatment_ids) as string[],
    vitalsSnapshot: row.vitals_snapshot ? (JSON.parse(row.vitals_snapshot) as Record<string, unknown>) : null,
    closedAt: row.closed_at,
    closedByPrincipalId: row.closed_by_principal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateMedicalReportParams {
  characterId: string
  createdByPrincipalId: string
  incidentId?: string | null | undefined
  arrestId?: string | null | undefined
  diagnosis: string
  notes?: string | undefined
  injuryIds?: string[] | undefined
  treatmentIds?: string[] | undefined
  vitalsSnapshot?: Record<string, unknown> | null | undefined
}

export interface ListMedicalReportsParams {
  characterId?: string | undefined
  incidentId?: string | undefined
  openOnly?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface MedicalReportPage {
  items: AtcMedicalReport[]
  total: number
  offset: number
  limit: number
}

export class MedicalReportRepository {
  constructor(private readonly pool: MedicalPool) {}

  async create(params: CreateMedicalReportParams): Promise<AtcMedicalReport> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_medical_reports
           (id, character_id, created_by_principal_id, incident_id, arrest_id,
            diagnosis, notes, injury_ids, treatment_ids, vitals_snapshot, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [
          id, params.characterId, params.createdByPrincipalId,
          params.incidentId ?? null, params.arrestId ?? null,
          params.diagnosis, params.notes ?? '',
          JSON.stringify(params.injuryIds ?? []),
          JSON.stringify(params.treatmentIds ?? []),
          params.vitalsSnapshot ? JSON.stringify(params.vitalsSnapshot) : null,
        ],
      )
      const report = await this._findById(conn, id)
      if (!report) throw new MedicalReportNotFoundError(id)
      return report
    } finally {
      conn.release()
    }
  }

  async close(id: string, closedByPrincipalId: string): Promise<AtcMedicalReport> {
    const conn = await this.pool.getConnection()
    try {
      const report = await this._findById(conn, id)
      if (!report) throw new MedicalReportNotFoundError(id)
      if (report.closedAt) throw new MedicalReportClosedError(id)

      await conn.execute(
        `UPDATE atc_medical_reports SET closed_at = NOW(3), closed_by_principal_id = ?, updated_at = NOW(3) WHERE id = ?`,
        [closedByPrincipalId, id],
      )
      const updated = await this._findById(conn, id)
      if (!updated) throw new MedicalReportNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcMedicalReport | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async list(params: ListMedicalReportsParams = {}): Promise<MedicalReportPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: (string | number | null)[] = []
    if (params.characterId)     { conditions.push('character_id = ?'); args.push(params.characterId) }
    if (params.incidentId)      { conditions.push('incident_id = ?');  args.push(params.incidentId) }
    if (params.openOnly === true){ conditions.push('closed_at IS NULL') }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_medical_reports ${where}`, args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<ReportRow[]>(
        `SELECT * FROM atc_medical_reports ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToReport), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  private async _findById(conn: Awaited<ReturnType<MedicalPool['getConnection']>>, id: string): Promise<AtcMedicalReport | null> {
    const [rows] = await conn.execute<ReportRow[]>(
      `SELECT * FROM atc_medical_reports WHERE id = ? LIMIT 1`, [id],
    )
    return rows[0] ? rowToReport(rows[0]) : null
  }
}
