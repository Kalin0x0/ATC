import type { RowDataPacket } from 'mysql2/promise'
import type { AtcVehicleImpound, AtcImpoundReason } from '@atc/shared-types'
import type { VehiclePool } from './pool.js'
import { generateId } from './id.js'
import { ImpoundNotFoundError, EvidenceHoldError } from './errors.js'

interface ImpoundRow extends RowDataPacket {
  id: string
  vehicle_id: string
  reason: string
  impounded_by_principal_id: string
  agency_id: string | null
  location_id: string | null
  evidence_hold: number
  fee: number
  notes: string | null
  impounded_at: Date
  released_at: Date | null
  released_by_principal_id: string | null
  release_notes: string | null
}

function rowToImpound(row: ImpoundRow): AtcVehicleImpound {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    reason: row.reason as AtcImpoundReason,
    impoundedByPrincipalId: row.impounded_by_principal_id,
    agencyId: row.agency_id,
    locationId: row.location_id,
    evidenceHold: row.evidence_hold === 1,
    fee: row.fee,
    notes: row.notes,
    impoundedAt: row.impounded_at,
    releasedAt: row.released_at,
    releasedByPrincipalId: row.released_by_principal_id,
    releaseNotes: row.release_notes,
  }
}

export interface CreateImpoundParams {
  vehicleId: string
  reason: AtcImpoundReason
  impoundedByPrincipalId: string
  agencyId?: string | null | undefined
  locationId?: string | null | undefined
  evidenceHold?: boolean | undefined
  fee?: number | undefined
  notes?: string | null | undefined
}

export class ImpoundRepository {
  constructor(private readonly pool: VehiclePool) {}

  async create(
    params: CreateImpoundParams,
    conn?: Awaited<ReturnType<VehiclePool['getConnection']>>,
  ): Promise<AtcVehicleImpound> {
    const id = generateId()
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      await connection.execute(
        `INSERT INTO atc_vehicle_impounds
           (id, vehicle_id, reason, impounded_by_principal_id,
            agency_id, location_id, evidence_hold, fee, notes, impounded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.vehicleId,
          params.reason,
          params.impoundedByPrincipalId,
          params.agencyId ?? null,
          params.locationId ?? null,
          params.evidenceHold ? 1 : 0,
          params.fee ?? 0,
          params.notes ?? null,
        ],
      )
      const [rows] = await connection.execute<ImpoundRow[]>(
        `SELECT * FROM atc_vehicle_impounds WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new ImpoundNotFoundError(params.vehicleId)
      return rowToImpound(rows[0])
    } finally {
      if (owned) connection.release()
    }
  }

  async release(
    vehicleId: string,
    releasedByPrincipalId: string,
    releaseNotes?: string | null,
    conn?: Awaited<ReturnType<VehiclePool['getConnection']>>,
  ): Promise<AtcVehicleImpound> {
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      const [rows] = await connection.execute<ImpoundRow[]>(
        `SELECT * FROM atc_vehicle_impounds
         WHERE vehicle_id = ? AND released_at IS NULL
         LIMIT 1 FOR UPDATE`,
        [vehicleId],
      )
      if (!rows[0]) throw new ImpoundNotFoundError(vehicleId)

      const impound = rowToImpound(rows[0])
      if (impound.evidenceHold) throw new EvidenceHoldError(vehicleId)

      await connection.execute(
        `UPDATE atc_vehicle_impounds
         SET released_at = NOW(3), released_by_principal_id = ?, release_notes = ?
         WHERE id = ?`,
        [releasedByPrincipalId, releaseNotes ?? null, impound.id],
      )

      const [updated] = await connection.execute<ImpoundRow[]>(
        `SELECT * FROM atc_vehicle_impounds WHERE id = ? LIMIT 1`,
        [impound.id],
      )
      if (!updated[0]) throw new ImpoundNotFoundError(vehicleId)
      return rowToImpound(updated[0])
    } finally {
      if (owned) connection.release()
    }
  }

  async findActiveForVehicle(vehicleId: string): Promise<AtcVehicleImpound | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ImpoundRow[]>(
        `SELECT * FROM atc_vehicle_impounds
         WHERE vehicle_id = ? AND released_at IS NULL
         ORDER BY impounded_at DESC LIMIT 1`,
        [vehicleId],
      )
      return rows[0] ? rowToImpound(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listByVehicle(vehicleId: string): Promise<AtcVehicleImpound[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ImpoundRow[]>(
        `SELECT * FROM atc_vehicle_impounds
         WHERE vehicle_id = ? ORDER BY impounded_at DESC`,
        [vehicleId],
      )
      return rows.map(rowToImpound)
    } finally {
      conn.release()
    }
  }
}
