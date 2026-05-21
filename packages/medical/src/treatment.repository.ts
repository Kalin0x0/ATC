import type { RowDataPacket } from 'mysql2/promise'
import type { AtcTreatmentRecord, AtcTreatmentType, AtcTraumaState } from '@atc/shared-types'
import type { MedicalPool } from './pool.js'
import { generateId } from './id.js'

interface TreatmentRow extends RowDataPacket {
  id: string
  character_id: string
  applied_by_principal_id: string
  incident_id: string | null
  type: string
  item_id: string | null
  notes: string | null
  previous_trauma: string | null
  resulting_trauma: string | null
  metadata: string
  applied_at: Date
}

function rowToTreatment(row: TreatmentRow): AtcTreatmentRecord {
  return {
    id: row.id,
    characterId: row.character_id,
    appliedByPrincipalId: row.applied_by_principal_id,
    incidentId: row.incident_id,
    type: row.type as AtcTreatmentType,
    itemId: row.item_id,
    notes: row.notes,
    previousTrauma: row.previous_trauma as AtcTraumaState | null,
    resultingTrauma: row.resulting_trauma as AtcTraumaState | null,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    appliedAt: row.applied_at,
  }
}

export interface ApplyTreatmentParams {
  characterId: string
  appliedByPrincipalId: string
  incidentId?: string | null | undefined
  type: AtcTreatmentType
  itemId?: string | null | undefined
  notes?: string | null | undefined
  previousTrauma?: AtcTraumaState | null | undefined
  resultingTrauma?: AtcTraumaState | null | undefined
  metadata?: Record<string, unknown> | undefined
}

export class TreatmentRepository {
  constructor(private readonly pool: MedicalPool) {}

  async apply(params: ApplyTreatmentParams): Promise<AtcTreatmentRecord> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_treatment_records
           (id, character_id, applied_by_principal_id, incident_id, type, item_id,
            notes, previous_trauma, resulting_trauma, metadata, applied_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id, params.characterId, params.appliedByPrincipalId, params.incidentId ?? null,
          params.type, params.itemId ?? null, params.notes ?? null,
          params.previousTrauma ?? null, params.resultingTrauma ?? null,
          JSON.stringify(params.metadata ?? {}),
        ],
      )
      const [rows] = await conn.execute<TreatmentRow[]>(
        `SELECT * FROM atc_treatment_records WHERE id = ? LIMIT 1`, [id],
      )
      return rowToTreatment(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async listByCharacter(characterId: string, limit = 50): Promise<AtcTreatmentRecord[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TreatmentRow[]>(
        `SELECT * FROM atc_treatment_records WHERE character_id = ? ORDER BY applied_at DESC LIMIT ?`,
        [characterId, Math.min(limit, 100)],
      )
      return rows.map(rowToTreatment)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcTreatmentRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TreatmentRow[]>(
        `SELECT * FROM atc_treatment_records WHERE id = ? LIMIT 1`, [id],
      )
      return rows[0] ? rowToTreatment(rows[0]) : null
    } finally {
      conn.release()
    }
  }
}
