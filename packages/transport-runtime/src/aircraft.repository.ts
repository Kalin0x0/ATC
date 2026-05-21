import type { RowDataPacket } from 'mysql2/promise'
import type { TransportRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { AircraftNotFoundError } from './errors.js'

export type AtcFlightStatus =
  | 'pending'
  | 'airborne'
  | 'landed'
  | 'diverted'
  | 'cancelled'

export type AtcAircraftStatus =
  | 'on_ground'
  | 'airborne'
  | 'maintenance'
  | 'decommissioned'

export interface AtcAircraft {
  id: string
  aircraftId: string
  aircraftName: string
  aircraftType: string
  ownedByPrincipalId: string | null
  status: AtcAircraftStatus
  positionX: number | null
  positionY: number | null
  positionZ: number | null
  heading: number | null
  altitudeM: number | null
  speedKmh: number | null
  currentZoneId: string | null
  lastTickAt: Date
  createdAt: Date
  updatedAt: Date
}

interface AircraftRow extends RowDataPacket {
  id: string
  aircraft_id: string
  aircraft_name: string
  aircraft_type: string
  owned_by_principal_id: string | null
  status: string
  position_x: number | null
  position_y: number | null
  position_z: number | null
  heading: number | null
  altitude_m: number | null
  speed_kmh: number | null
  current_zone_id: string | null
  last_tick_at: Date
  created_at: Date
  updated_at: Date
}

function rowToAircraft(row: AircraftRow): AtcAircraft {
  return {
    id: row.id,
    aircraftId: row.aircraft_id,
    aircraftName: row.aircraft_name,
    aircraftType: row.aircraft_type,
    ownedByPrincipalId: row.owned_by_principal_id,
    status: row.status as AtcAircraftStatus,
    positionX: row.position_x,
    positionY: row.position_y,
    positionZ: row.position_z,
    heading: row.heading,
    altitudeM: row.altitude_m,
    speedKmh: row.speed_kmh,
    currentZoneId: row.current_zone_id,
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class AircraftRepository {
  constructor(private readonly pool: TransportRuntimePool) {}

  async findById(aircraftId: string): Promise<AtcAircraft | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AircraftRow[]>(
        'SELECT * FROM `atc_aircraft` WHERE `aircraft_id` = ? LIMIT 1',
        [aircraftId],
      )
      return rows[0] ? rowToAircraft(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcAircraft[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AircraftRow[]>(
        'SELECT * FROM `atc_aircraft` ORDER BY `created_at` ASC',
      )
      return rows.map(rowToAircraft)
    } finally {
      conn.release()
    }
  }

  async upsert(params: {
    aircraftId: string
    aircraftName: string
    aircraftType: string
    ownedByPrincipalId?: string
  }): Promise<AtcAircraft> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const ownerBind: string | null = params.ownedByPrincipalId !== undefined
        ? params.ownedByPrincipalId
        : null
      const binds: (string | number | boolean | null)[] = [
        id,
        params.aircraftId,
        params.aircraftName,
        params.aircraftType,
        ownerBind,
        params.aircraftName,
        params.aircraftType,
        ownerBind,
      ]
      await conn.execute(
        `INSERT INTO \`atc_aircraft\`
           (\`id\`, \`aircraft_id\`, \`aircraft_name\`, \`aircraft_type\`, \`owned_by_principal_id\`,
            \`status\`, \`last_tick_at\`, \`created_at\`, \`updated_at\`)
         VALUES (?, ?, ?, ?, ?, 'on_ground', NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           \`aircraft_name\` = ?,
           \`aircraft_type\` = ?,
           \`owned_by_principal_id\` = ?,
           \`updated_at\` = NOW(3)`,
        binds,
      )
      const aircraft = await this.findById(params.aircraftId)
      if (aircraft === null) throw new AircraftNotFoundError(params.aircraftId)
      return aircraft
    } finally {
      conn.release()
    }
  }

  async updateStatus(aircraftId: string, status: AtcAircraftStatus): Promise<AtcAircraft> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<AircraftRow[]>(
          'SELECT * FROM `atc_aircraft` WHERE `aircraft_id` = ? FOR UPDATE',
          [aircraftId],
        )
        if (!rows[0]) throw new AircraftNotFoundError(aircraftId)
        await conn.execute(
          'UPDATE `atc_aircraft` SET `status` = ?, `updated_at` = NOW(3) WHERE `aircraft_id` = ?',
          [status, aircraftId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
    const aircraft = await this.findById(aircraftId)
    if (aircraft === null) throw new AircraftNotFoundError(aircraftId)
    return aircraft
  }
}
