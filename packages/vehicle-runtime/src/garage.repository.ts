import type { RowDataPacket } from 'mysql2/promise'
import type { AtcVehicleGarageRecord, AtcGarageSummary } from '@atc/shared-types'
import type { VehiclePool } from './pool.js'
import { generateId } from './id.js'
import { GarageVehicleNotFoundError } from './errors.js'

interface GarageRow extends RowDataPacket {
  id: string
  vehicle_id: string
  garage_id: string
  stored_by_principal_id: string
  stored_at: Date
  retrieved_at: Date | null
  retrieved_by_principal_id: string | null
}

function rowToRecord(row: GarageRow): AtcVehicleGarageRecord {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    garageId: row.garage_id,
    storedByPrincipalId: row.stored_by_principal_id,
    storedAt: row.stored_at,
    retrievedAt: row.retrieved_at,
    retrievedByPrincipalId: row.retrieved_by_principal_id,
  }
}

export class GarageRepository {
  constructor(private readonly pool: VehiclePool) {}

  async store(
    vehicleId: string,
    garageId: string,
    storedByPrincipalId: string,
    conn?: Awaited<ReturnType<VehiclePool['getConnection']>>,
  ): Promise<AtcVehicleGarageRecord> {
    const id = generateId()
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      await connection.execute(
        `INSERT INTO atc_vehicle_garages
           (id, vehicle_id, garage_id, stored_by_principal_id, stored_at)
         VALUES (?, ?, ?, ?, NOW(3))`,
        [id, vehicleId, garageId, storedByPrincipalId],
      )
      const [rows] = await connection.execute<GarageRow[]>(
        `SELECT * FROM atc_vehicle_garages WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new GarageVehicleNotFoundError(vehicleId, garageId)
      return rowToRecord(rows[0])
    } finally {
      if (owned) connection.release()
    }
  }

  async retrieve(
    vehicleId: string,
    garageId: string,
    retrievedByPrincipalId: string,
    conn?: Awaited<ReturnType<VehiclePool['getConnection']>>,
  ): Promise<AtcVehicleGarageRecord> {
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      const [rows] = await connection.execute<GarageRow[]>(
        `SELECT * FROM atc_vehicle_garages
         WHERE vehicle_id = ? AND garage_id = ? AND retrieved_at IS NULL
         LIMIT 1 FOR UPDATE`,
        [vehicleId, garageId],
      )
      if (!rows[0]) throw new GarageVehicleNotFoundError(vehicleId, garageId)

      await connection.execute(
        `UPDATE atc_vehicle_garages
         SET retrieved_at = NOW(3), retrieved_by_principal_id = ?
         WHERE id = ?`,
        [retrievedByPrincipalId, rows[0].id],
      )

      const [updated] = await connection.execute<GarageRow[]>(
        `SELECT * FROM atc_vehicle_garages WHERE id = ? LIMIT 1`,
        [rows[0].id],
      )
      if (!updated[0]) throw new GarageVehicleNotFoundError(vehicleId, garageId)
      return rowToRecord(updated[0])
    } finally {
      if (owned) connection.release()
    }
  }

  async findActiveForVehicle(vehicleId: string): Promise<AtcVehicleGarageRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GarageRow[]>(
        `SELECT * FROM atc_vehicle_garages
         WHERE vehicle_id = ? AND retrieved_at IS NULL
         ORDER BY stored_at DESC LIMIT 1`,
        [vehicleId],
      )
      return rows[0] ? rowToRecord(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listActiveByGarage(garageId: string): Promise<AtcVehicleGarageRecord[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GarageRow[]>(
        `SELECT * FROM atc_vehicle_garages
         WHERE garage_id = ? AND retrieved_at IS NULL
         ORDER BY stored_at DESC`,
        [garageId],
      )
      return rows.map(rowToRecord)
    } finally {
      conn.release()
    }
  }

  async listGarages(): Promise<AtcGarageSummary[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<(RowDataPacket & { garage_id: string; cnt: number })[]>(
        `SELECT g.garage_id, COUNT(*) AS cnt
         FROM atc_vehicle_garages g
         JOIN atc_vehicles v ON v.id = g.vehicle_id
         WHERE g.retrieved_at IS NULL AND v.status = 'stored'
         GROUP BY g.garage_id
         ORDER BY g.garage_id`,
      )
      return rows.map(r => ({ garageId: r.garage_id, vehicleCount: r.cnt }))
    } finally {
      conn.release()
    }
  }
}
