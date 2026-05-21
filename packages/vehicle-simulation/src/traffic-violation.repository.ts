import type { RowDataPacket } from 'mysql2/promise'
import type { VehicleSimPool } from './pool.js'
import { generateId } from './id.js'
import { TrafficViolationNotFoundError } from './errors.js'

export type AtcViolationType =
  | 'speeding'
  | 'reckless_driving'
  | 'running_red_light'
  | 'wrong_way'
  | 'illegal_parking'
  | 'hit_and_run'
  | 'dui'
  | 'other'

export interface AtcTrafficViolation {
  id: string
  vehicleId: string
  vehicleRuntimeId: string | null
  principalId: string
  violationType: AtcViolationType
  speedRecorded: number | null
  speedLimit: number | null
  locationX: number | null
  locationY: number | null
  locationZ: number | null
  recordedByPrincipalId: string | null
  fineAmount: number
  isPaid: boolean
  paidAt: Date | null
  createdAt: Date
}

interface ViolationRow extends RowDataPacket {
  id: string
  vehicle_id: string
  vehicle_runtime_id: string | null
  principal_id: string
  violation_type: string
  speed_recorded: number | null
  speed_limit: number | null
  location_x: number | null
  location_y: number | null
  location_z: number | null
  recorded_by_principal_id: string | null
  fine_amount: number
  is_paid: number
  paid_at: Date | null
  created_at: Date
}

function rowToViolation(row: ViolationRow): AtcTrafficViolation {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    vehicleRuntimeId: row.vehicle_runtime_id,
    principalId: row.principal_id,
    violationType: row.violation_type as AtcViolationType,
    speedRecorded: row.speed_recorded !== null ? Number(row.speed_recorded) : null,
    speedLimit: row.speed_limit !== null ? Number(row.speed_limit) : null,
    locationX: row.location_x !== null ? Number(row.location_x) : null,
    locationY: row.location_y !== null ? Number(row.location_y) : null,
    locationZ: row.location_z !== null ? Number(row.location_z) : null,
    recordedByPrincipalId: row.recorded_by_principal_id,
    fineAmount: row.fine_amount,
    isPaid: row.is_paid === 1,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  }
}

export interface RecordViolationParams {
  vehicleId: string
  vehicleRuntimeId?: string | null | undefined
  principalId: string
  violationType: AtcViolationType
  speedRecorded?: number | null | undefined
  speedLimit?: number | null | undefined
  locationX?: number | null | undefined
  locationY?: number | null | undefined
  locationZ?: number | null | undefined
  recordedByPrincipalId?: string | null | undefined
  fineAmount?: number | undefined
}

export class TrafficViolationRepository {
  constructor(private readonly pool: VehicleSimPool) {}

  async record(params: RecordViolationParams): Promise<AtcTrafficViolation> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_vehicle_traffic_violations
           (id, vehicle_id, vehicle_runtime_id, principal_id, violation_type,
            speed_recorded, speed_limit, location_x, location_y, location_z,
            recorded_by_principal_id, fine_amount, is_paid, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(3))`,
        [
          id,
          params.vehicleId,
          params.vehicleRuntimeId ?? null,
          params.principalId,
          params.violationType,
          params.speedRecorded ?? null,
          params.speedLimit ?? null,
          params.locationX ?? null,
          params.locationY ?? null,
          params.locationZ ?? null,
          params.recordedByPrincipalId ?? null,
          params.fineAmount ?? 0,
        ],
      )
      const [rows] = await conn.execute<ViolationRow[]>(
        `SELECT * FROM atc_vehicle_traffic_violations WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new TrafficViolationNotFoundError(id)
      return rowToViolation(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcTrafficViolation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ViolationRow[]>(
        `SELECT * FROM atc_vehicle_traffic_violations WHERE id = ? LIMIT 1`,
        [id],
      )
      return rows[0] ? rowToViolation(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async markPaid(id: string): Promise<AtcTrafficViolation> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_vehicle_traffic_violations
         SET is_paid = 1, paid_at = NOW(3)
         WHERE id = ?`,
        [id],
      )
      const [rows] = await conn.execute<ViolationRow[]>(
        `SELECT * FROM atc_vehicle_traffic_violations WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new TrafficViolationNotFoundError(id)
      return rowToViolation(rows[0])
    } finally {
      conn.release()
    }
  }

  async listByPrincipal(principalId: string, limit: number): Promise<AtcTrafficViolation[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ViolationRow[]>(
        `SELECT * FROM atc_vehicle_traffic_violations
         WHERE principal_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [principalId, limit],
      )
      return rows.map(rowToViolation)
    } finally {
      conn.release()
    }
  }

  async listUnpaidByPrincipal(principalId: string): Promise<AtcTrafficViolation[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ViolationRow[]>(
        `SELECT * FROM atc_vehicle_traffic_violations
         WHERE principal_id = ? AND is_paid = 0
         ORDER BY created_at DESC`,
        [principalId],
      )
      return rows.map(rowToViolation)
    } finally {
      conn.release()
    }
  }
}
