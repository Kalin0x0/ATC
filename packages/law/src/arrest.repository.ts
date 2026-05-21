import type { RowDataPacket } from 'mysql2/promise'
import type { AtcArrestRecord, AtcLawSeverity } from '@atc/shared-types'
import type { LawPool } from './pool.js'
import { generateId } from './id.js'
import { ArrestNotFoundError } from './errors.js'

interface ArrestRow extends RowDataPacket {
  id: string
  character_id: string
  arrested_by_principal_id: string
  agency_id: string
  warrant_id: string | null
  reason: string
  severity: string
  notes: string | null
  created_at: Date
}

function rowToArrest(row: ArrestRow): AtcArrestRecord {
  return {
    id: row.id,
    characterId: row.character_id,
    arrestedByPrincipalId: row.arrested_by_principal_id,
    agencyId: row.agency_id,
    warrantId: row.warrant_id,
    reason: row.reason,
    severity: row.severity as AtcLawSeverity,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export interface CreateArrestParams {
  characterId: string
  arrestedByPrincipalId: string
  agencyId: string
  warrantId?: string | null | undefined
  reason: string
  severity: AtcLawSeverity
  notes?: string | null | undefined
}

export interface ListArrestsParams {
  characterId?: string | undefined
  agencyId?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface ArrestPage {
  items: AtcArrestRecord[]
  total: number
  offset: number
  limit: number
}

export class ArrestRepository {
  constructor(private readonly pool: LawPool) {}

  async create(params: CreateArrestParams): Promise<AtcArrestRecord> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_arrest_records
           (id, character_id, arrested_by_principal_id, agency_id, warrant_id, reason, severity, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id, params.characterId, params.arrestedByPrincipalId, params.agencyId,
          params.warrantId ?? null, params.reason, params.severity, params.notes ?? null,
        ],
      )
      const [rows] = await conn.execute<ArrestRow[]>(
        'SELECT * FROM atc_arrest_records WHERE id = ? LIMIT 1',
        [id],
      )
      if (!rows[0]) throw new ArrestNotFoundError(id)
      return rowToArrest(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcArrestRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ArrestRow[]>(
        'SELECT * FROM atc_arrest_records WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToArrest(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listByCharacter(characterId: string): Promise<AtcArrestRecord[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ArrestRow[]>(
        'SELECT * FROM atc_arrest_records WHERE character_id = ? ORDER BY created_at DESC',
        [characterId],
      )
      return rows.map(rowToArrest)
    } finally {
      conn.release()
    }
  }

  async list(params: ListArrestsParams = {}): Promise<ArrestPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: (string | number | null)[] = []
    if (params.characterId) { conditions.push('character_id = ?'); args.push(params.characterId) }
    if (params.agencyId)    { conditions.push('agency_id = ?');    args.push(params.agencyId) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_arrest_records ${where}`, args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<ArrestRow[]>(
        `SELECT * FROM atc_arrest_records ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToArrest), total, offset, limit }
    } finally {
      conn.release()
    }
  }
}
