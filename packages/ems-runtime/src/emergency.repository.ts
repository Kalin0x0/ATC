import type { RowDataPacket } from 'mysql2/promise'
import type { AtcEmsEmergency, AtcEmsEmergencyAudit, AtcEmergencyStatus, AtcTriageCategory } from '@atc/shared-types'
import type { EmsPool } from './pool.js'
import { generateId } from './id.js'
import { EmergencyNotFoundError, EmergencyClosedError, EmergencyImmutableError } from './errors.js'

interface EmergencyRow extends RowDataPacket {
  id: string
  character_id: string
  incident_id: string | null
  status: string
  triage_category: string | null
  assigned_responder_ids: string
  notes: string | null
  created_by_principal_id: string
  closed_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToEmergency(row: EmergencyRow): AtcEmsEmergency {
  return {
    id: row.id,
    characterId: row.character_id,
    incidentId: row.incident_id,
    status: row.status as AtcEmergencyStatus,
    triageCategory: row.triage_category as AtcTriageCategory | null,
    assignedResponderIds: JSON.parse(row.assigned_responder_ids) as string[],
    notes: row.notes,
    createdByPrincipalId: row.created_by_principal_id,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Valid state machine transitions
const ALLOWED_TRANSITIONS: Record<AtcEmergencyStatus, AtcEmergencyStatus[]> = {
  reported:            ['triaged', 'closed'],
  triaged:             ['responders_assigned', 'closed'],
  responders_assigned: ['en_route', 'stabilized', 'closed'],
  en_route:            ['on_scene', 'stabilized'],
  on_scene:            ['stabilized'],
  stabilized:          ['transported', 'closed'],
  transported:         ['admitted', 'closed'],
  admitted:            ['closed'],
  closed:              [],
}

export interface CreateEmergencyParams {
  characterId: string
  incidentId?: string | null | undefined
  createdByPrincipalId: string
  notes?: string | null | undefined
}

export interface TransitionEmergencyParams {
  id: string
  newStatus: AtcEmergencyStatus
  principalId: string
  notes?: string | null | undefined
  metadata?: Record<string, unknown> | undefined
}

export interface AssignResponderParams {
  id: string
  responderPrincipalId: string
  principalId: string
}

export interface TriageEmergencyParams {
  id: string
  category: AtcTriageCategory
  principalId: string
  notes?: string | null | undefined
}

export class EmergencyRepository {
  constructor(private readonly pool: EmsPool) {}

  async create(params: CreateEmergencyParams): Promise<AtcEmsEmergency> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_ems_emergencies
           (id, character_id, incident_id, status, triage_category, assigned_responder_ids,
            notes, created_by_principal_id, created_at, updated_at)
         VALUES (?, ?, ?, 'reported', NULL, '[]', ?, ?, NOW(3), NOW(3))`,
        [id, params.characterId, params.incidentId ?? null, params.notes ?? null, params.createdByPrincipalId],
      )
      // Insert creation audit
      await conn.execute(
        `INSERT INTO atc_ems_emergency_audit
           (id, emergency_id, action, from_status, to_status, principal_id, notes, metadata, created_at)
         VALUES (?, ?, 'created', NULL, 'reported', ?, ?, '{}', NOW(3))`,
        [generateId(), id, params.createdByPrincipalId, params.notes ?? null],
      )
      const emergency = await this._findById(conn, id)
      if (!emergency) throw new EmergencyNotFoundError(id)
      return emergency
    } finally {
      conn.release()
    }
  }

  async triage(params: TriageEmergencyParams): Promise<AtcEmsEmergency> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<EmergencyRow[]>(
          `SELECT * FROM atc_ems_emergencies WHERE id = ? LIMIT 1 FOR UPDATE`,
          [params.id],
        )
        const current = rows[0] ? rowToEmergency(rows[0]) : null
        if (!current) throw new EmergencyNotFoundError(params.id)
        if (current.status === 'closed') throw new EmergencyClosedError(params.id)
        if (!ALLOWED_TRANSITIONS[current.status].includes('triaged')) {
          throw new EmergencyImmutableError(params.id, current.status, 'triaged')
        }
        await conn.execute(
          `UPDATE atc_ems_emergencies
           SET status = 'triaged', triage_category = ?, notes = COALESCE(?, notes), updated_at = NOW(3)
           WHERE id = ?`,
          [params.category, params.notes ?? null, params.id],
        )
        await conn.execute(
          `INSERT INTO atc_ems_emergency_audit
             (id, emergency_id, action, from_status, to_status, principal_id, notes, metadata, created_at)
           VALUES (?, ?, 'triage', ?, 'triaged', ?, ?, ?, NOW(3))`,
          [generateId(), params.id, current.status, params.principalId, params.notes ?? null,
           JSON.stringify({ category: params.category })],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const updated = await this._findById(conn, params.id)
      if (!updated) throw new EmergencyNotFoundError(params.id)
      return updated
    } finally {
      conn.release()
    }
  }

  async assignResponder(params: AssignResponderParams): Promise<AtcEmsEmergency> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<EmergencyRow[]>(
          `SELECT * FROM atc_ems_emergencies WHERE id = ? LIMIT 1 FOR UPDATE`,
          [params.id],
        )
        const current = rows[0] ? rowToEmergency(rows[0]) : null
        if (!current) throw new EmergencyNotFoundError(params.id)
        if (current.status === 'closed') throw new EmergencyClosedError(params.id)

        const alreadyAssigned = current.assignedResponderIds.includes(params.responderPrincipalId)
        const newResponderIds = alreadyAssigned
          ? current.assignedResponderIds
          : [...current.assignedResponderIds, params.responderPrincipalId]

        // Auto-advance from triaged → responders_assigned on first assignment
        const newStatus: AtcEmergencyStatus = current.status === 'triaged'
          ? 'responders_assigned'
          : current.status

        await conn.execute(
          `UPDATE atc_ems_emergencies
           SET assigned_responder_ids = ?, status = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [JSON.stringify(newResponderIds), newStatus, params.id],
        )
        await conn.execute(
          `INSERT INTO atc_ems_emergency_audit
             (id, emergency_id, action, from_status, to_status, principal_id, notes, metadata, created_at)
           VALUES (?, ?, 'assign_responder', ?, ?, ?, NULL, ?, NOW(3))`,
          [generateId(), params.id, current.status, newStatus, params.principalId,
           JSON.stringify({ responder: params.responderPrincipalId, idempotent: alreadyAssigned })],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const updated = await this._findById(conn, params.id)
      if (!updated) throw new EmergencyNotFoundError(params.id)
      return updated
    } finally {
      conn.release()
    }
  }

  async transition(params: TransitionEmergencyParams): Promise<AtcEmsEmergency> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<EmergencyRow[]>(
          `SELECT * FROM atc_ems_emergencies WHERE id = ? LIMIT 1 FOR UPDATE`,
          [params.id],
        )
        const current = rows[0] ? rowToEmergency(rows[0]) : null
        if (!current) throw new EmergencyNotFoundError(params.id)
        if (current.status === 'closed') throw new EmergencyClosedError(params.id)

        const allowed = ALLOWED_TRANSITIONS[current.status]
        if (!allowed.includes(params.newStatus)) {
          throw new EmergencyImmutableError(params.id, current.status, params.newStatus)
        }

        const closedAtClause = params.newStatus === 'closed' ? ', closed_at = NOW(3)' : ''
        await conn.execute(
          `UPDATE atc_ems_emergencies
           SET status = ? ${closedAtClause}, updated_at = NOW(3)
           WHERE id = ?`,
          [params.newStatus, params.id],
        )
        await conn.execute(
          `INSERT INTO atc_ems_emergency_audit
             (id, emergency_id, action, from_status, to_status, principal_id, notes, metadata, created_at)
           VALUES (?, ?, 'transition', ?, ?, ?, ?, ?, NOW(3))`,
          [generateId(), params.id, current.status, params.newStatus, params.principalId,
           params.notes ?? null, JSON.stringify(params.metadata ?? {})],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const updated = await this._findById(conn, params.id)
      if (!updated) throw new EmergencyNotFoundError(params.id)
      return updated
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcEmsEmergency | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcEmsEmergency[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EmergencyRow[]>(
        `SELECT * FROM atc_ems_emergencies WHERE status != 'closed' ORDER BY created_at DESC`,
      )
      return rows.map(rowToEmergency)
    } finally {
      conn.release()
    }
  }

  async listAudit(emergencyId: string): Promise<AtcEmsEmergencyAudit[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<(RowDataPacket & {
        id: string; emergency_id: string; action: string; from_status: string | null;
        to_status: string | null; principal_id: string; notes: string | null;
        metadata: string; created_at: Date
      })[]>(
        `SELECT * FROM atc_ems_emergency_audit WHERE emergency_id = ? ORDER BY created_at ASC`,
        [emergencyId],
      )
      return rows.map(r => ({
        id: r.id,
        emergencyId: r.emergency_id,
        action: r.action,
        fromStatus: r.from_status,
        toStatus: r.to_status,
        principalId: r.principal_id,
        notes: r.notes,
        metadata: JSON.parse(r.metadata) as Record<string, unknown>,
        createdAt: r.created_at,
      }))
    } finally {
      conn.release()
    }
  }

  private async _findById(conn: Awaited<ReturnType<EmsPool['getConnection']>>, id: string): Promise<AtcEmsEmergency | null> {
    const [rows] = await conn.execute<EmergencyRow[]>(
      `SELECT * FROM atc_ems_emergencies WHERE id = ? LIMIT 1`, [id],
    )
    return rows[0] ? rowToEmergency(rows[0]) : null
  }
}
