import type { RowDataPacket } from 'mysql2/promise'
import type { AtcInjuryRecord, AtcBodyRegion, AtcMedicalSeverity } from '@atc/shared-types'
import type { MedicalPool } from './pool.js'
import { generateId } from './id.js'
import { InjuryNotFoundError } from './errors.js'

interface InjuryRow extends RowDataPacket {
  id: string
  character_id: string
  agency_id: string | null
  incident_id: string | null
  recorded_by_principal_id: string
  region: string
  severity: string
  description: string
  metadata: string
  created_at: Date
  updated_at: Date
}

function rowToInjury(row: InjuryRow): AtcInjuryRecord {
  return {
    id: row.id,
    characterId: row.character_id,
    agencyId: row.agency_id,
    incidentId: row.incident_id,
    recordedByPrincipalId: row.recorded_by_principal_id,
    region: row.region as AtcBodyRegion,
    severity: row.severity as AtcMedicalSeverity,
    description: row.description,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface RecordInjuryParams {
  characterId: string
  agencyId?: string | null | undefined
  incidentId?: string | null | undefined
  recordedByPrincipalId: string
  region: AtcBodyRegion
  severity: AtcMedicalSeverity
  description: string
  metadata?: Record<string, unknown> | undefined
}

export interface ListInjuriesParams {
  characterId?: string | undefined
  incidentId?: string | undefined
  severity?: AtcMedicalSeverity | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface InjuryPage {
  items: AtcInjuryRecord[]
  total: number
  offset: number
  limit: number
}

export class InjuryRepository {
  constructor(private readonly pool: MedicalPool) {}

  async record(params: RecordInjuryParams): Promise<AtcInjuryRecord> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_injuries
           (id, character_id, agency_id, incident_id, recorded_by_principal_id,
            region, severity, description, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [
          id, params.characterId, params.agencyId ?? null, params.incidentId ?? null,
          params.recordedByPrincipalId, params.region, params.severity,
          params.description, JSON.stringify(params.metadata ?? {}),
        ],
      )
      const injury = await this._findById(conn, id)
      if (!injury) throw new InjuryNotFoundError(id)
      return injury
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcInjuryRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async listByCharacter(characterId: string): Promise<AtcInjuryRecord[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InjuryRow[]>(
        `SELECT * FROM atc_injuries WHERE character_id = ? ORDER BY created_at DESC`,
        [characterId],
      )
      return rows.map(rowToInjury)
    } finally {
      conn.release()
    }
  }

  async list(params: ListInjuriesParams = {}): Promise<InjuryPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: (string | number | null)[] = []
    if (params.characterId) { conditions.push('character_id = ?'); args.push(params.characterId) }
    if (params.incidentId)  { conditions.push('incident_id = ?');  args.push(params.incidentId) }
    if (params.severity)    { conditions.push('severity = ?');     args.push(params.severity) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_injuries ${where}`, args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<InjuryRow[]>(
        `SELECT * FROM atc_injuries ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToInjury), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  private async _findById(conn: Awaited<ReturnType<MedicalPool['getConnection']>>, id: string): Promise<AtcInjuryRecord | null> {
    const [rows] = await conn.execute<InjuryRow[]>(
      `SELECT * FROM atc_injuries WHERE id = ? LIMIT 1`, [id],
    )
    return rows[0] ? rowToInjury(rows[0]) : null
  }
}
