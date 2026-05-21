import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { AtcHospitalCapacity } from '@atc/shared-types'
import type { EmsPool } from './pool.js'
import { generateId } from './id.js'
import { HospitalCapacityNotFoundError, HospitalAtCapacityError } from './errors.js'

interface CapacityRow extends RowDataPacket {
  id: string
  facility_id: string
  total_beds: number
  available_beds: number
  icu_total: number
  icu_available: number
  er_total: number
  er_available: number
  is_diversion: number
  is_overflow: number
  updated_at: Date
}

function rowToCapacity(row: CapacityRow): AtcHospitalCapacity {
  return {
    id: row.id,
    facilityId: row.facility_id,
    totalBeds: row.total_beds,
    availableBeds: row.available_beds,
    icuTotal: row.icu_total,
    icuAvailable: row.icu_available,
    erTotal: row.er_total,
    erAvailable: row.er_available,
    isDiversion: row.is_diversion === 1,
    isOverflow: row.is_overflow === 1,
    updatedAt: row.updated_at,
  }
}

export interface UpsertCapacityParams {
  facilityId: string
  totalBeds?: number | undefined
  availableBeds?: number | undefined
  icuTotal?: number | undefined
  icuAvailable?: number | undefined
  erTotal?: number | undefined
  erAvailable?: number | undefined
  isDiversion?: boolean | undefined
  isOverflow?: boolean | undefined
}

export class HospitalCapacityRepository {
  constructor(private readonly pool: EmsPool) {}

  async upsert(params: UpsertCapacityParams): Promise<AtcHospitalCapacity> {
    const conn = await this.pool.getConnection()
    try {
      const existing = await this._findByFacilityId(conn, params.facilityId)
      if (!existing) {
        const id = generateId()
        await conn.execute(
          `INSERT INTO atc_ems_hospital_capacity
             (id, facility_id, total_beds, available_beds, icu_total, icu_available,
              er_total, er_available, is_diversion, is_overflow, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
          [
            id, params.facilityId,
            params.totalBeds ?? 0, params.availableBeds ?? 0,
            params.icuTotal ?? 0, params.icuAvailable ?? 0,
            params.erTotal ?? 0, params.erAvailable ?? 0,
            params.isDiversion ? 1 : 0, params.isOverflow ? 1 : 0,
          ],
        )
      } else {
        await conn.execute(
          `UPDATE atc_ems_hospital_capacity
           SET total_beds      = COALESCE(?, total_beds),
               available_beds  = COALESCE(?, available_beds),
               icu_total       = COALESCE(?, icu_total),
               icu_available   = COALESCE(?, icu_available),
               er_total        = COALESCE(?, er_total),
               er_available    = COALESCE(?, er_available),
               is_diversion    = COALESCE(?, is_diversion),
               is_overflow     = COALESCE(?, is_overflow),
               updated_at      = NOW(3)
           WHERE facility_id = ?`,
          [
            params.totalBeds ?? null, params.availableBeds ?? null,
            params.icuTotal ?? null, params.icuAvailable ?? null,
            params.erTotal ?? null, params.erAvailable ?? null,
            params.isDiversion !== undefined ? (params.isDiversion ? 1 : 0) : null,
            params.isOverflow !== undefined ? (params.isOverflow ? 1 : 0) : null,
            params.facilityId,
          ],
        )
      }
      const updated = await this._findByFacilityId(conn, params.facilityId)
      if (!updated) throw new HospitalCapacityNotFoundError(params.facilityId)
      return updated
    } finally {
      conn.release()
    }
  }

  // Atomic decrement — returns false if no beds available (caller throws)
  async admitPatient(facilityId: string): Promise<AtcHospitalCapacity> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_ems_hospital_capacity
         SET available_beds = available_beds - 1,
             is_overflow = CASE WHEN (available_beds - 1) <= 0 THEN 1 ELSE is_overflow END,
             updated_at = NOW(3)
         WHERE facility_id = ? AND available_beds > 0`,
        [facilityId],
      )
      if (result.affectedRows === 0) {
        throw new HospitalAtCapacityError(facilityId)
      }
      const updated = await this._findByFacilityId(conn, facilityId)
      if (!updated) throw new HospitalCapacityNotFoundError(facilityId)
      return updated
    } finally {
      conn.release()
    }
  }

  async dischargePatient(facilityId: string): Promise<AtcHospitalCapacity> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_ems_hospital_capacity
         SET available_beds = LEAST(available_beds + 1, total_beds),
             is_overflow = CASE WHEN (available_beds + 1) > 0 THEN 0 ELSE is_overflow END,
             updated_at = NOW(3)
         WHERE facility_id = ?`,
        [facilityId],
      )
      const updated = await this._findByFacilityId(conn, facilityId)
      if (!updated) throw new HospitalCapacityNotFoundError(facilityId)
      return updated
    } finally {
      conn.release()
    }
  }

  async setDiversion(facilityId: string, isDiversion: boolean): Promise<AtcHospitalCapacity> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_ems_hospital_capacity SET is_diversion = ?, updated_at = NOW(3) WHERE facility_id = ?`,
        [isDiversion ? 1 : 0, facilityId],
      )
      const updated = await this._findByFacilityId(conn, facilityId)
      if (!updated) throw new HospitalCapacityNotFoundError(facilityId)
      return updated
    } finally {
      conn.release()
    }
  }

  async findByFacilityId(facilityId: string): Promise<AtcHospitalCapacity | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findByFacilityId(conn, facilityId)
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcHospitalCapacity[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CapacityRow[]>(
        `SELECT * FROM atc_ems_hospital_capacity ORDER BY facility_id ASC`,
      )
      return rows.map(rowToCapacity)
    } finally {
      conn.release()
    }
  }

  private async _findByFacilityId(conn: Awaited<ReturnType<EmsPool['getConnection']>>, facilityId: string): Promise<AtcHospitalCapacity | null> {
    const [rows] = await conn.execute<CapacityRow[]>(
      `SELECT * FROM atc_ems_hospital_capacity WHERE facility_id = ? LIMIT 1`, [facilityId],
    )
    return rows[0] ? rowToCapacity(rows[0]) : null
  }
}
