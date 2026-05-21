import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { AtcAmbulanceUnit, AtcAmbulanceStatus } from '@atc/shared-types'
import type { EmsPool } from './pool.js'
import { generateId } from './id.js'
import { AmbulanceNotFoundError, AmbulanceUnavailableError } from './errors.js'

interface AmbulanceRow extends RowDataPacket {
  id: string
  unit_id: string
  status: string
  emergency_id: string | null
  facility_id: string | null
  last_updated_by: string
  created_at: Date
  updated_at: Date
}

function rowToUnit(row: AmbulanceRow): AtcAmbulanceUnit {
  return {
    id: row.id,
    unitId: row.unit_id,
    status: row.status as AtcAmbulanceStatus,
    emergencyId: row.emergency_id,
    facilityId: row.facility_id,
    lastUpdatedBy: row.last_updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const AMBULANCE_TRANSITIONS: Record<AtcAmbulanceStatus, AtcAmbulanceStatus[]> = {
  available:    ['dispatched'],
  dispatched:   ['en_route', 'available'],
  en_route:     ['transporting', 'available'],
  transporting: ['hospital'],
  hospital:     ['available'],
}

export class AmbulanceRepository {
  constructor(private readonly pool: EmsPool) {}

  async register(unitId: string, principalId: string): Promise<AtcAmbulanceUnit> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_ems_ambulances
             (id, unit_id, status, emergency_id, facility_id, last_updated_by, created_at, updated_at)
           VALUES (?, ?, 'available', NULL, NULL, ?, NOW(3), NOW(3))`,
          [id, unitId, principalId],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          const existing = await this._findByUnitId(conn, unitId)
          if (existing) return existing
        }
        throw err
      }
      const unit = await this._findByUnitId(conn, unitId)
      if (!unit) throw new AmbulanceNotFoundError(unitId)
      return unit
    } finally {
      conn.release()
    }
  }

  // Atomic dispatch: only succeeds if unit is 'available' — prevents double-assignment
  async dispatch(unitId: string, emergencyId: string, principalId: string): Promise<AtcAmbulanceUnit> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_ems_ambulances
         SET status = 'dispatched', emergency_id = ?, last_updated_by = ?, updated_at = NOW(3)
         WHERE unit_id = ? AND status = 'available'`,
        [emergencyId, principalId, unitId],
      )
      if (result.affectedRows === 0) {
        const unit = await this._findByUnitId(conn, unitId)
        if (!unit) throw new AmbulanceNotFoundError(unitId)
        throw new AmbulanceUnavailableError(unitId, unit.status)
      }
      const updated = await this._findByUnitId(conn, unitId)
      if (!updated) throw new AmbulanceNotFoundError(unitId)
      return updated
    } finally {
      conn.release()
    }
  }

  async transition(unitId: string, newStatus: AtcAmbulanceStatus, principalId: string, facilityId?: string | null): Promise<AtcAmbulanceUnit> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<AmbulanceRow[]>(
          `SELECT * FROM atc_ems_ambulances WHERE unit_id = ? LIMIT 1 FOR UPDATE`,
          [unitId],
        )
        const current = rows[0] ? rowToUnit(rows[0]) : null
        if (!current) throw new AmbulanceNotFoundError(unitId)

        const allowed = AMBULANCE_TRANSITIONS[current.status]
        if (!allowed.includes(newStatus)) {
          throw new AmbulanceUnavailableError(unitId, current.status)
        }

        const clearEmergency = newStatus === 'available'
        await conn.execute(
          `UPDATE atc_ems_ambulances
           SET status = ?,
               facility_id = ?,
               ${clearEmergency ? 'emergency_id = NULL,' : ''}
               last_updated_by = ?,
               updated_at = NOW(3)
           WHERE unit_id = ?`,
          [newStatus, facilityId ?? current.facilityId, principalId, unitId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const updated = await this._findByUnitId(conn, unitId)
      if (!updated) throw new AmbulanceNotFoundError(unitId)
      return updated
    } finally {
      conn.release()
    }
  }

  async findByUnitId(unitId: string): Promise<AtcAmbulanceUnit | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findByUnitId(conn, unitId)
    } finally {
      conn.release()
    }
  }

  async listAvailable(): Promise<AtcAmbulanceUnit[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AmbulanceRow[]>(
        `SELECT * FROM atc_ems_ambulances WHERE status = 'available' ORDER BY updated_at ASC`,
      )
      return rows.map(rowToUnit)
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcAmbulanceUnit[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AmbulanceRow[]>(
        `SELECT * FROM atc_ems_ambulances WHERE status != 'available' ORDER BY updated_at DESC`,
      )
      return rows.map(rowToUnit)
    } finally {
      conn.release()
    }
  }

  private async _findByUnitId(conn: Awaited<ReturnType<EmsPool['getConnection']>>, unitId: string): Promise<AtcAmbulanceUnit | null> {
    const [rows] = await conn.execute<AmbulanceRow[]>(
      `SELECT * FROM atc_ems_ambulances WHERE unit_id = ? LIMIT 1`, [unitId],
    )
    return rows[0] ? rowToUnit(rows[0]) : null
  }
}
