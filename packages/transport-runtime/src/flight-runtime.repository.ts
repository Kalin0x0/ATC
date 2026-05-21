import type { RowDataPacket } from 'mysql2/promise'
import type { TransportRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { FlightNotFoundError, DuplicateFlightNonceError } from './errors.js'
import type { AtcFlightStatus } from './aircraft.repository.js'

export interface AtcFlightRuntime {
  id: string
  flightId: string
  flightNonce: string
  aircraftId: string
  originZoneId: string
  destinationZoneId: string
  status: AtcFlightStatus
  departedAt: Date | null
  landedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface FlightRow extends RowDataPacket {
  id: string
  flight_id: string
  flight_nonce: string
  aircraft_id: string
  origin_zone_id: string
  destination_zone_id: string
  status: string
  departed_at: Date | null
  landed_at: Date | null
  created_at: Date
  updated_at: Date
}

function isMysqlDupEntryError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'ER_DUP_ENTRY'
  )
}

function rowToFlight(row: FlightRow): AtcFlightRuntime {
  return {
    id: row.id,
    flightId: row.flight_id,
    flightNonce: row.flight_nonce,
    aircraftId: row.aircraft_id,
    originZoneId: row.origin_zone_id,
    destinationZoneId: row.destination_zone_id,
    status: row.status as AtcFlightStatus,
    departedAt: row.departed_at,
    landedAt: row.landed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class FlightRuntimeRepository {
  constructor(private readonly pool: TransportRuntimePool) {}

  async findById(flightId: string): Promise<AtcFlightRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FlightRow[]>(
        'SELECT * FROM `atc_flight_runtime` WHERE `flight_id` = ? LIMIT 1',
        [flightId],
      )
      return rows[0] ? rowToFlight(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcFlightRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FlightRow[]>(
        "SELECT * FROM `atc_flight_runtime` WHERE `status` IN ('pending', 'airborne') ORDER BY `created_at` ASC",
      )
      return rows.map(rowToFlight)
    } finally {
      conn.release()
    }
  }

  async create(params: {
    flightNonce: string
    aircraftId: string
    originZoneId: string
    destinationZoneId: string
  }): Promise<AtcFlightRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const flightId = generateId()
      const binds: (string | number | boolean | null)[] = [
        id,
        flightId,
        params.flightNonce,
        params.aircraftId,
        params.originZoneId,
        params.destinationZoneId,
      ]
      try {
        await conn.execute(
          `INSERT INTO \`atc_flight_runtime\`
             (\`id\`, \`flight_id\`, \`flight_nonce\`, \`aircraft_id\`,
              \`origin_zone_id\`, \`destination_zone_id\`, \`status\`,
              \`created_at\`, \`updated_at\`)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(3), NOW(3))`,
          binds,
        )
      } catch (err) {
        if (isMysqlDupEntryError(err)) {
          throw new DuplicateFlightNonceError(params.flightNonce)
        }
        throw err
      }
      const flight = await this.findById(flightId)
      if (flight === null) throw new FlightNotFoundError(flightId)
      return flight
    } finally {
      conn.release()
    }
  }

  async transition(flightId: string, status: AtcFlightStatus): Promise<AtcFlightRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<FlightRow[]>(
          'SELECT * FROM `atc_flight_runtime` WHERE `flight_id` = ? FOR UPDATE',
          [flightId],
        )
        if (!rows[0]) throw new FlightNotFoundError(flightId)

        const setParts: string[] = ['`status` = ?', '`updated_at` = NOW(3)']
        const binds: (string | number | boolean | null)[] = [status]

        if (status === 'airborne') {
          setParts.push('`departed_at` = NOW(3)')
        } else if (status === 'landed' || status === 'diverted') {
          setParts.push('`landed_at` = NOW(3)')
        }

        binds.push(flightId)
        await conn.execute(
          `UPDATE \`atc_flight_runtime\` SET ${setParts.join(', ')} WHERE \`flight_id\` = ?`,
          binds,
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
    const flight = await this.findById(flightId)
    if (flight === null) throw new FlightNotFoundError(flightId)
    return flight
  }
}
