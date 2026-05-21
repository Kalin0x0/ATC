import type { RowDataPacket } from 'mysql2'
import type { LogisticsRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { LogisticsFleetNotFoundError } from './errors.js'

export type AtcFleetStatus = 'available' | 'deployed' | 'maintenance'

export interface AtcLogisticsFleet {
  id: string
  fleetId: string
  fleetName: string
  ownerPrincipalId: string
  vehicleIds: string[]
  status: AtcFleetStatus
  assignedRouteId: string | null
  createdAt: Date
  updatedAt: Date
}

interface LogisticsFleetRow extends RowDataPacket {
  id: string
  fleet_id: string
  fleet_name: string
  owner_principal_id: string
  vehicle_ids: string
  status: AtcFleetStatus
  assigned_route_id: string | null
  created_at: Date
  updated_at: Date
}

function rowToFleet(row: LogisticsFleetRow): AtcLogisticsFleet {
  return {
    id: row.id,
    fleetId: row.fleet_id,
    fleetName: row.fleet_name,
    ownerPrincipalId: row.owner_principal_id,
    vehicleIds: JSON.parse(row.vehicle_ids) as string[],
    status: row.status,
    assignedRouteId: row.assigned_route_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class LogisticsFleetRepository {
  constructor(private readonly pool: LogisticsRuntimePool) {}

  async findByFleetId(fleetId: string): Promise<AtcLogisticsFleet | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<LogisticsFleetRow[]>(
        'SELECT * FROM atc_logistics_fleets WHERE fleet_id = ? LIMIT 1',
        [fleetId],
      )
      const row = rows[0]
      return row !== undefined ? rowToFleet(row) : null
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcLogisticsFleet[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<LogisticsFleetRow[]>(
        'SELECT * FROM atc_logistics_fleets ORDER BY fleet_name ASC',
      )
      return rows.map(rowToFleet)
    } finally {
      conn.release()
    }
  }

  async create(params: {
    fleetId: string
    fleetName: string
    ownerPrincipalId: string
    vehicleIds?: string[]
  }): Promise<AtcLogisticsFleet> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const vehicleIds = JSON.stringify(params.vehicleIds ?? [])
      const binds: (string | number | boolean | null)[] = [
        id,
        params.fleetId,
        params.fleetName,
        params.ownerPrincipalId,
        vehicleIds,
      ]
      await conn.query(
        `INSERT INTO atc_logistics_fleets
          (id, fleet_id, fleet_name, owner_principal_id, vehicle_ids, status, assigned_route_id)
         VALUES (?, ?, ?, ?, ?, 'available', NULL)`,
        binds,
      )
      const [rows] = await conn.query<LogisticsFleetRow[]>(
        'SELECT * FROM atc_logistics_fleets WHERE id = ? LIMIT 1',
        [id],
      )
      const row = rows[0]
      if (row === undefined) throw new LogisticsFleetNotFoundError(params.fleetId)
      return rowToFleet(row)
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    fleetId: string,
    status: AtcFleetStatus,
    assignedRouteId?: string | null,
  ): Promise<AtcLogisticsFleet> {
    const conn = await this.pool.getConnection()
    let committed = false
    try {
      await conn.beginTransaction()
      const [rows] = await conn.query<LogisticsFleetRow[]>(
        'SELECT * FROM atc_logistics_fleets WHERE fleet_id = ? LIMIT 1 FOR UPDATE',
        [fleetId],
      )
      const row = rows[0]
      if (row === undefined) {
        throw new LogisticsFleetNotFoundError(fleetId)
      }

      const resolvedRouteId =
        assignedRouteId !== undefined ? assignedRouteId : row.assigned_route_id

      const binds: (string | number | boolean | null)[] = [
        status,
        resolvedRouteId,
        fleetId,
      ]
      await conn.query(
        'UPDATE atc_logistics_fleets SET status = ?, assigned_route_id = ?, updated_at = NOW(3) WHERE fleet_id = ?',
        binds,
      )
      await conn.commit()
      committed = true

      const [updated] = await conn.query<LogisticsFleetRow[]>(
        'SELECT * FROM atc_logistics_fleets WHERE fleet_id = ? LIMIT 1',
        [fleetId],
      )
      const updatedRow = updated[0]
      if (updatedRow === undefined) throw new LogisticsFleetNotFoundError(fleetId)
      return rowToFleet(updatedRow)
    } catch (err) {
      if (!committed) await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }
}
