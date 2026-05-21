import type { RowDataPacket } from 'mysql2/promise'
import type {
  AtcBoloRecord,
  AtcBoloNote,
  AtcBoloStatus,
  AtcLawSeverity,
} from '@atc/shared-types'
import type { DispatchPool } from './pool.js'
import { generateId } from './id.js'
import { BoloNotFoundError, BoloImmutableError } from './errors.js'

interface BoloRow extends RowDataPacket {
  id: string
  agency_id: string
  created_by_principal_id: string
  severity: string
  description: string
  linked_warrant_id: string | null
  linked_character_id: string | null
  linked_vehicle_id: string | null
  notes: string
  status: string
  expires_at: Date | null
  expired_at: Date | null
  archived_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToBolo(row: BoloRow): AtcBoloRecord {
  return {
    id: row.id,
    agencyId: row.agency_id,
    createdByPrincipalId: row.created_by_principal_id,
    severity: row.severity as AtcLawSeverity,
    description: row.description,
    linkedWarrantId: row.linked_warrant_id,
    linkedCharacterId: row.linked_character_id,
    linkedVehicleId: row.linked_vehicle_id,
    notes: JSON.parse(row.notes) as AtcBoloNote[],
    status: row.status as AtcBoloStatus,
    expiresAt: row.expires_at,
    expiredAt: row.expired_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateBoloParams {
  agencyId: string
  createdByPrincipalId: string
  severity: AtcLawSeverity
  description: string
  linkedWarrantId?: string | null | undefined
  linkedCharacterId?: string | null | undefined
  linkedVehicleId?: string | null | undefined
  expiresAt?: Date | null | undefined
}

export interface AddBoloNoteParams {
  boloId: string
  principalId: string
  text: string
}

export interface ListBolosParams {
  agencyId?: string | undefined
  status?: AtcBoloStatus | undefined
  linkedCharacterId?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface BoloPage {
  items: AtcBoloRecord[]
  total: number
  offset: number
  limit: number
}

export class BoloRepository {
  constructor(private readonly pool: DispatchPool) {}

  async create(params: CreateBoloParams): Promise<AtcBoloRecord> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_bolo_records
           (id, agency_id, created_by_principal_id, severity, description,
            linked_warrant_id, linked_character_id, linked_vehicle_id,
            notes, status, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, JSON_ARRAY(), 'active', ?, NOW(3), NOW(3))`,
        [id, params.agencyId, params.createdByPrincipalId, params.severity, params.description,
         params.linkedWarrantId ?? null, params.linkedCharacterId ?? null, params.linkedVehicleId ?? null,
         params.expiresAt ?? null],
      )
      const bolo = await this._findById(conn, id)
      if (!bolo) throw new BoloNotFoundError(id)
      return bolo
    } finally {
      conn.release()
    }
  }

  async expire(id: string): Promise<AtcBoloRecord> {
    const conn = await this.pool.getConnection()
    try {
      const bolo = await this._findById(conn, id)
      if (!bolo) throw new BoloNotFoundError(id)
      if (bolo.status !== 'active') throw new BoloImmutableError(id, bolo.status)

      await conn.execute(
        `UPDATE atc_bolo_records SET status = 'expired', expired_at = NOW(3), updated_at = NOW(3) WHERE id = ?`,
        [id],
      )
      const updated = await this._findById(conn, id)
      if (!updated) throw new BoloNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async archive(id: string): Promise<AtcBoloRecord> {
    const conn = await this.pool.getConnection()
    try {
      const bolo = await this._findById(conn, id)
      if (!bolo) throw new BoloNotFoundError(id)
      if (bolo.status === 'archived') throw new BoloImmutableError(id, bolo.status)

      await conn.execute(
        `UPDATE atc_bolo_records SET status = 'archived', archived_at = NOW(3), updated_at = NOW(3) WHERE id = ?`,
        [id],
      )
      const updated = await this._findById(conn, id)
      if (!updated) throw new BoloNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async addNote(params: AddBoloNoteParams): Promise<AtcBoloRecord> {
    const conn = await this.pool.getConnection()
    try {
      const bolo = await this._findById(conn, params.boloId)
      if (!bolo) throw new BoloNotFoundError(params.boloId)
      if (bolo.status === 'archived') throw new BoloImmutableError(params.boloId, bolo.status)

      const note: AtcBoloNote = {
        principalId: params.principalId,
        text: params.text,
        createdAt: new Date().toISOString(),
      }
      const updatedNotes = [...bolo.notes, note]

      await conn.execute(
        `UPDATE atc_bolo_records SET notes = ?, updated_at = NOW(3) WHERE id = ?`,
        [JSON.stringify(updatedNotes), params.boloId],
      )
      const updated = await this._findById(conn, params.boloId)
      if (!updated) throw new BoloNotFoundError(params.boloId)
      return updated
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcBoloRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async list(params: ListBolosParams = {}): Promise<BoloPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: (string | number | null)[] = []
    if (params.agencyId)         { conditions.push('agency_id = ?');           args.push(params.agencyId) }
    if (params.status)           { conditions.push('status = ?');              args.push(params.status) }
    if (params.linkedCharacterId){ conditions.push('linked_character_id = ?'); args.push(params.linkedCharacterId) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_bolo_records ${where}`, args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<BoloRow[]>(
        `SELECT * FROM atc_bolo_records ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToBolo), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  private async _findById(conn: Awaited<ReturnType<DispatchPool['getConnection']>>, id: string): Promise<AtcBoloRecord | null> {
    const [rows] = await conn.execute<BoloRow[]>(
      `SELECT * FROM atc_bolo_records WHERE id = ? LIMIT 1`, [id],
    )
    return rows[0] ? rowToBolo(rows[0]) : null
  }
}
