import type { RowDataPacket } from 'mysql2/promise'
import type { AtcHospitalRecord, AtcHospitalStatus } from '@atc/shared-types'
import type { MedicalPool } from './pool.js'
import { generateId } from './id.js'
import { HospitalRecordNotFoundError, HospitalAlreadyAdmittedError, HospitalImmutableError } from './errors.js'

interface HospitalRow extends RowDataPacket {
  id: string
  character_id: string
  admitted_by_principal_id: string
  status: string
  facility_id: string | null
  incident_id: string | null
  notes: string | null
  admitted_at: Date
  status_changed_at: Date
  discharged_at: Date | null
  updated_at: Date
}

function rowToRecord(row: HospitalRow): AtcHospitalRecord {
  return {
    id: row.id,
    characterId: row.character_id,
    admittedByPrincipalId: row.admitted_by_principal_id,
    status: row.status as AtcHospitalStatus,
    facilityId: row.facility_id,
    incidentId: row.incident_id,
    notes: row.notes,
    admittedAt: row.admitted_at,
    statusChangedAt: row.status_changed_at,
    dischargedAt: row.discharged_at,
    updatedAt: row.updated_at,
  }
}

const ALLOWED_STATUS_TRANSITIONS: Record<AtcHospitalStatus, AtcHospitalStatus[]> = {
  admitted:   ['icu', 'surgery', 'discharged', 'deceased'],
  icu:        ['surgery', 'discharged', 'deceased'],
  surgery:    ['icu', 'discharged', 'deceased'],
  discharged: [],
  deceased:   [],
}

export interface AdmitToHospitalParams {
  characterId: string
  admittedByPrincipalId: string
  facilityId?: string | null | undefined
  incidentId?: string | null | undefined
  notes?: string | null | undefined
}

export interface UpdateHospitalStatusParams {
  id: string
  newStatus: AtcHospitalStatus
  updatedByPrincipalId: string
  notes?: string | null | undefined
}

export class HospitalRepository {
  constructor(private readonly pool: MedicalPool) {}

  async admit(params: AdmitToHospitalParams): Promise<AtcHospitalRecord> {
    const conn = await this.pool.getConnection()
    try {
      const existing = await this._findActiveForCharacter(conn, params.characterId)
      if (existing) throw new HospitalAlreadyAdmittedError(params.characterId)

      const id = generateId()
      await conn.execute(
        `INSERT INTO atc_hospital_states
           (id, character_id, admitted_by_principal_id, status, facility_id, incident_id,
            notes, admitted_at, status_changed_at, updated_at)
         VALUES (?, ?, ?, 'admitted', ?, ?, ?, NOW(3), NOW(3), NOW(3))`,
        [
          id, params.characterId, params.admittedByPrincipalId,
          params.facilityId ?? null, params.incidentId ?? null,
          params.notes ?? null,
        ],
      )
      const record = await this._findById(conn, id)
      if (!record) throw new HospitalRecordNotFoundError(id)
      return record
    } finally {
      conn.release()
    }
  }

  async updateStatus(params: UpdateHospitalStatusParams): Promise<AtcHospitalRecord> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<HospitalRow[]>(
          `SELECT * FROM atc_hospital_states WHERE id = ? LIMIT 1 FOR UPDATE`,
          [params.id],
        )
        const current = rows[0] ? rowToRecord(rows[0]) : null
        if (!current) throw new HospitalRecordNotFoundError(params.id)

        const allowed = ALLOWED_STATUS_TRANSITIONS[current.status]
        if (!allowed.includes(params.newStatus)) {
          throw new HospitalImmutableError(params.id, current.status)
        }

        const isDischarge = params.newStatus === 'discharged' || params.newStatus === 'deceased'
        await conn.execute(
          `UPDATE atc_hospital_states
           SET status = ?, notes = ?, status_changed_at = NOW(3),
               discharged_at = ${isDischarge ? 'NOW(3)' : 'discharged_at'},
               updated_at = NOW(3)
           WHERE id = ?`,
          [params.newStatus, params.notes ?? current.notes, params.id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const updated = await this._findById(conn, params.id)
      if (!updated) throw new HospitalRecordNotFoundError(params.id)
      return updated
    } finally {
      conn.release()
    }
  }

  async findActiveForCharacter(characterId: string): Promise<AtcHospitalRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findActiveForCharacter(conn, characterId)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcHospitalRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  private async _findActiveForCharacter(conn: Awaited<ReturnType<MedicalPool['getConnection']>>, characterId: string): Promise<AtcHospitalRecord | null> {
    const [rows] = await conn.execute<HospitalRow[]>(
      `SELECT * FROM atc_hospital_states WHERE character_id = ? AND status NOT IN ('discharged', 'deceased') LIMIT 1`,
      [characterId],
    )
    return rows[0] ? rowToRecord(rows[0]) : null
  }

  private async _findById(conn: Awaited<ReturnType<MedicalPool['getConnection']>>, id: string): Promise<AtcHospitalRecord | null> {
    const [rows] = await conn.execute<HospitalRow[]>(
      `SELECT * FROM atc_hospital_states WHERE id = ? LIMIT 1`, [id],
    )
    return rows[0] ? rowToRecord(rows[0]) : null
  }
}
