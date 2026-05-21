import type { RowDataPacket } from 'mysql2/promise'
import type { VehicleSimPool } from './pool.js'
import { generateId } from './id.js'
import { MetricsNotFoundError } from './errors.js'

export interface AtcVehicleRuntimeMetrics {
  id: string
  vehicleRuntimeId: string
  distanceTraveled: number
  topSpeedRecorded: number
  totalCollisions: number
  engineRuntimeMinutes: number
  lastHeartbeatAt: Date
  createdAt: Date
  updatedAt: Date
}

interface MetricsRow extends RowDataPacket {
  id: string
  vehicle_runtime_id: string
  distance_traveled: number
  top_speed_recorded: number
  total_collisions: number
  engine_runtime_minutes: number
  last_heartbeat_at: Date
  created_at: Date
  updated_at: Date
}

function rowToMetrics(row: MetricsRow): AtcVehicleRuntimeMetrics {
  return {
    id: row.id,
    vehicleRuntimeId: row.vehicle_runtime_id,
    distanceTraveled: Number(row.distance_traveled),
    topSpeedRecorded: Number(row.top_speed_recorded),
    totalCollisions: row.total_collisions,
    engineRuntimeMinutes: row.engine_runtime_minutes,
    lastHeartbeatAt: row.last_heartbeat_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeMetricsRepository {
  constructor(private readonly pool: VehicleSimPool) {}

  async upsert(vehicleRuntimeId: string): Promise<AtcVehicleRuntimeMetrics> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_vehicle_runtime_metrics
           (id, vehicle_runtime_id, distance_traveled, top_speed_recorded,
            total_collisions, engine_runtime_minutes, last_heartbeat_at, created_at, updated_at)
         VALUES (?, ?, 0.00, 0.00, 0, 0, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE id = id`,
        [id, vehicleRuntimeId],
      )
      const [rows] = await conn.execute<MetricsRow[]>(
        `SELECT * FROM atc_vehicle_runtime_metrics WHERE vehicle_runtime_id = ? LIMIT 1`,
        [vehicleRuntimeId],
      )
      if (!rows[0]) throw new MetricsNotFoundError(vehicleRuntimeId)
      return rowToMetrics(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByRuntimeId(vehicleRuntimeId: string): Promise<AtcVehicleRuntimeMetrics | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MetricsRow[]>(
        `SELECT * FROM atc_vehicle_runtime_metrics WHERE vehicle_runtime_id = ? LIMIT 1`,
        [vehicleRuntimeId],
      )
      return rows[0] ? rowToMetrics(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async recordHeartbeat(
    vehicleRuntimeId: string,
    distanceDelta: number,
    topSpeed: number,
    collisionDelta: number,
    engineMinutes: number,
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_vehicle_runtime_metrics
         SET distance_traveled      = distance_traveled + ?,
             top_speed_recorded     = GREATEST(top_speed_recorded, ?),
             total_collisions       = total_collisions + ?,
             engine_runtime_minutes = engine_runtime_minutes + ?,
             last_heartbeat_at      = NOW(3),
             updated_at             = NOW(3)
         WHERE vehicle_runtime_id = ?`,
        [distanceDelta, topSpeed, collisionDelta, engineMinutes, vehicleRuntimeId],
      )
    } finally {
      conn.release()
    }
  }

  async incrementCollisions(vehicleRuntimeId: string, count: number): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_vehicle_runtime_metrics
         SET total_collisions = total_collisions + ?,
             updated_at       = NOW(3)
         WHERE vehicle_runtime_id = ?`,
        [count, vehicleRuntimeId],
      )
    } finally {
      conn.release()
    }
  }
}
