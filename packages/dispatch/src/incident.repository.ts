import type { RowDataPacket } from 'mysql2/promise'
import type {
  AtcIncident,
  AtcIncidentNote,
  AtcIncidentStatus,
  AtcDispatchPriority,
} from '@atc/shared-types'
import type { DispatchPool } from './pool.js'
import { generateId } from './id.js'
import { IncidentNotFoundError, IncidentImmutableError } from './errors.js'

interface IncidentRow extends RowDataPacket {
  id: string
  call_id: string | null
  agency_id: string
  status: string
  priority: string
  title: string
  location: string | null
  notes: string
  evidence_ids: string
  arrest_ids: string
  citation_ids: string
  created_by_principal_id: string
  resolved_at: Date | null
  archived_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToIncident(row: IncidentRow): AtcIncident {
  return {
    id: row.id,
    callId: row.call_id,
    agencyId: row.agency_id,
    status: row.status as AtcIncidentStatus,
    priority: row.priority as AtcDispatchPriority,
    title: row.title,
    location: row.location,
    notes: JSON.parse(row.notes) as AtcIncidentNote[],
    evidenceIds: JSON.parse(row.evidence_ids) as string[],
    arrestIds: JSON.parse(row.arrest_ids) as string[],
    citationIds: JSON.parse(row.citation_ids) as string[],
    createdByPrincipalId: row.created_by_principal_id,
    resolvedAt: row.resolved_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateIncidentParams {
  callId?: string | null | undefined
  agencyId: string
  priority: AtcDispatchPriority
  title: string
  location?: string | null | undefined
  createdByPrincipalId: string
}

export interface AddIncidentNoteParams {
  incidentId: string
  principalId: string
  text: string
}

export interface ListIncidentsParams {
  agencyId?: string | undefined
  status?: AtcIncidentStatus | undefined
  priority?: AtcDispatchPriority | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface IncidentPage {
  items: AtcIncident[]
  total: number
  offset: number
  limit: number
}

export class IncidentRepository {
  constructor(private readonly pool: DispatchPool) {}

  async create(params: CreateIncidentParams): Promise<AtcIncident> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_incidents
           (id, call_id, agency_id, status, priority, title, location,
            notes, evidence_ids, arrest_ids, citation_ids,
            created_by_principal_id, created_at, updated_at)
         VALUES (?, ?, ?, 'open', ?, ?, ?,
                 JSON_ARRAY(), JSON_ARRAY(), JSON_ARRAY(), JSON_ARRAY(),
                 ?, NOW(3), NOW(3))`,
        [id, params.callId ?? null, params.agencyId, params.priority, params.title,
         params.location ?? null, params.createdByPrincipalId],
      )
      const incident = await this._findById(conn, id)
      if (!incident) throw new IncidentNotFoundError(id)
      return incident
    } finally {
      conn.release()
    }
  }

  async escalate(id: string): Promise<AtcIncident> {
    const conn = await this.pool.getConnection()
    try {
      const incident = await this._findById(conn, id)
      if (!incident) throw new IncidentNotFoundError(id)
      if (incident.status !== 'open') throw new IncidentImmutableError(id, incident.status)

      await conn.execute(
        `UPDATE atc_incidents SET status = 'active', updated_at = NOW(3) WHERE id = ?`,
        [id],
      )
      const updated = await this._findById(conn, id)
      if (!updated) throw new IncidentNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async resolve(id: string): Promise<AtcIncident> {
    const conn = await this.pool.getConnection()
    try {
      const incident = await this._findById(conn, id)
      if (!incident) throw new IncidentNotFoundError(id)
      if (incident.status === 'resolved' || incident.status === 'archived') {
        throw new IncidentImmutableError(id, incident.status)
      }

      await conn.execute(
        `UPDATE atc_incidents SET status = 'resolved', resolved_at = NOW(3), updated_at = NOW(3) WHERE id = ?`,
        [id],
      )
      const updated = await this._findById(conn, id)
      if (!updated) throw new IncidentNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async archive(id: string): Promise<AtcIncident> {
    const conn = await this.pool.getConnection()
    try {
      const incident = await this._findById(conn, id)
      if (!incident) throw new IncidentNotFoundError(id)
      if (incident.status !== 'resolved') throw new IncidentImmutableError(id, incident.status)

      await conn.execute(
        `UPDATE atc_incidents SET status = 'archived', archived_at = NOW(3), updated_at = NOW(3) WHERE id = ?`,
        [id],
      )
      const updated = await this._findById(conn, id)
      if (!updated) throw new IncidentNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async addNote(params: AddIncidentNoteParams): Promise<AtcIncident> {
    const conn = await this.pool.getConnection()
    try {
      const incident = await this._findById(conn, params.incidentId)
      if (!incident) throw new IncidentNotFoundError(params.incidentId)
      if (incident.status === 'archived') throw new IncidentImmutableError(params.incidentId, incident.status)

      const note: AtcIncidentNote = {
        principalId: params.principalId,
        text: params.text,
        createdAt: new Date().toISOString(),
      }
      const updatedNotes = [...incident.notes, note]

      await conn.execute(
        `UPDATE atc_incidents SET notes = ?, updated_at = NOW(3) WHERE id = ?`,
        [JSON.stringify(updatedNotes), params.incidentId],
      )
      const updated = await this._findById(conn, params.incidentId)
      if (!updated) throw new IncidentNotFoundError(params.incidentId)
      return updated
    } finally {
      conn.release()
    }
  }

  async linkEvidence(incidentId: string, evidenceId: string): Promise<AtcIncident> {
    return this._appendToJsonArray(incidentId, 'evidence_ids', evidenceId)
  }

  async linkArrest(incidentId: string, arrestId: string): Promise<AtcIncident> {
    return this._appendToJsonArray(incidentId, 'arrest_ids', arrestId)
  }

  async linkCitation(incidentId: string, citationId: string): Promise<AtcIncident> {
    return this._appendToJsonArray(incidentId, 'citation_ids', citationId)
  }

  async findById(id: string): Promise<AtcIncident | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async listByAgency(agencyId: string): Promise<AtcIncident[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<IncidentRow[]>(
        `SELECT * FROM atc_incidents WHERE agency_id = ? ORDER BY created_at DESC`,
        [agencyId],
      )
      return rows.map(rowToIncident)
    } finally {
      conn.release()
    }
  }

  async list(params: ListIncidentsParams = {}): Promise<IncidentPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: (string | number | null)[] = []
    if (params.agencyId)  { conditions.push('agency_id = ?');  args.push(params.agencyId) }
    if (params.status)    { conditions.push('status = ?');     args.push(params.status) }
    if (params.priority)  { conditions.push('priority = ?');   args.push(params.priority) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_incidents ${where}`, args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<IncidentRow[]>(
        `SELECT * FROM atc_incidents ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToIncident), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  private async _appendToJsonArray(incidentId: string, column: string, value: string): Promise<AtcIncident> {
    const conn = await this.pool.getConnection()
    try {
      const incident = await this._findById(conn, incidentId)
      if (!incident) throw new IncidentNotFoundError(incidentId)

      await conn.execute(
        `UPDATE atc_incidents SET ${column} = JSON_ARRAY_APPEND(${column}, '$', ?), updated_at = NOW(3) WHERE id = ?`,
        [value, incidentId],
      )
      const updated = await this._findById(conn, incidentId)
      if (!updated) throw new IncidentNotFoundError(incidentId)
      return updated
    } finally {
      conn.release()
    }
  }

  private async _findById(conn: Awaited<ReturnType<DispatchPool['getConnection']>>, id: string): Promise<AtcIncident | null> {
    const [rows] = await conn.execute<IncidentRow[]>(
      `SELECT * FROM atc_incidents WHERE id = ? LIMIT 1`, [id],
    )
    return rows[0] ? rowToIncident(rows[0]) : null
  }
}
