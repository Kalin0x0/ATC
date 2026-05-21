import type { RowDataPacket } from 'mysql2'
import type { LogisticsRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { SupplyRouteNotFoundError } from './errors.js'

export type AtcRouteType = 'ground' | 'air' | 'sea' | 'rail'

export interface AtcSupplyRoute {
  id: string
  routeId: string
  routeName: string
  originNodeId: string
  destinationNodeId: string
  routeType: AtcRouteType
  distanceKm: number
  estimatedDurationMinutes: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface SupplyRouteRow extends RowDataPacket {
  id: string
  route_id: string
  route_name: string
  origin_node_id: string
  destination_node_id: string
  route_type: AtcRouteType
  distance_km: number
  estimated_duration_minutes: number
  is_active: number | boolean
  created_at: Date
  updated_at: Date
}

function rowToRoute(row: SupplyRouteRow): AtcSupplyRoute {
  return {
    id: row.id,
    routeId: row.route_id,
    routeName: row.route_name,
    originNodeId: row.origin_node_id,
    destinationNodeId: row.destination_node_id,
    routeType: row.route_type,
    distanceKm: row.distance_km,
    estimatedDurationMinutes: row.estimated_duration_minutes,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SupplyRouteRepository {
  constructor(private readonly pool: LogisticsRuntimePool) {}

  async findByRouteId(routeId: string): Promise<AtcSupplyRoute | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<SupplyRouteRow[]>(
        'SELECT * FROM atc_supply_routes WHERE route_id = ? LIMIT 1',
        [routeId],
      )
      const row = rows[0]
      return row !== undefined ? rowToRoute(row) : null
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcSupplyRoute[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<SupplyRouteRow[]>(
        'SELECT * FROM atc_supply_routes WHERE is_active = 1 ORDER BY route_name ASC',
      )
      return rows.map(rowToRoute)
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcSupplyRoute[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<SupplyRouteRow[]>(
        'SELECT * FROM atc_supply_routes ORDER BY route_name ASC',
      )
      return rows.map(rowToRoute)
    } finally {
      conn.release()
    }
  }

  async upsert(params: {
    routeId: string
    routeName: string
    originNodeId: string
    destinationNodeId: string
    routeType: AtcRouteType
    distanceKm: number
    estimatedDurationMinutes: number
  }): Promise<AtcSupplyRoute> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const binds: (string | number | boolean | null)[] = [
        id,
        params.routeId,
        params.routeName,
        params.originNodeId,
        params.destinationNodeId,
        params.routeType,
        params.distanceKm,
        params.estimatedDurationMinutes,
        params.routeName,
        params.originNodeId,
        params.destinationNodeId,
        params.routeType,
        params.distanceKm,
        params.estimatedDurationMinutes,
      ]
      await conn.query(
        `INSERT INTO atc_supply_routes
          (id, route_id, route_name, origin_node_id, destination_node_id, route_type, distance_km, estimated_duration_minutes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           route_name = ?,
           origin_node_id = ?,
           destination_node_id = ?,
           route_type = ?,
           distance_km = ?,
           estimated_duration_minutes = ?,
           updated_at = NOW(3)`,
        binds,
      )
      const [rows] = await conn.query<SupplyRouteRow[]>(
        'SELECT * FROM atc_supply_routes WHERE route_id = ? LIMIT 1',
        [params.routeId],
      )
      const row = rows[0]
      if (row === undefined) throw new SupplyRouteNotFoundError(params.routeId)
      return rowToRoute(row)
    } finally {
      conn.release()
    }
  }
}
