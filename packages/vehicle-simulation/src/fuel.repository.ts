import type { RowDataPacket } from 'mysql2/promise'
import type { VehicleSimPool } from './pool.js'
import { generateId } from './id.js'
import { FuelRecordNotFoundError, FuelTankEmptyError } from './errors.js'

export type AtcFuelGrade = 'regular' | 'premium' | 'diesel' | 'electric'

export interface AtcVehicleFuel {
  id: string
  vehicleRuntimeId: string
  tankCapacity: number
  currentFuel: number
  fuelGrade: AtcFuelGrade
  consumptionRate: number
  lastRefuelAt: Date | null
  lastSyncAt: Date
  createdAt: Date
  updatedAt: Date
}

interface FuelRow extends RowDataPacket {
  id: string
  vehicle_runtime_id: string
  tank_capacity: number
  current_fuel: number
  fuel_grade: string
  consumption_rate: number
  last_refuel_at: Date | null
  last_sync_at: Date
  created_at: Date
  updated_at: Date
}

function rowToFuel(row: FuelRow): AtcVehicleFuel {
  return {
    id: row.id,
    vehicleRuntimeId: row.vehicle_runtime_id,
    tankCapacity: Number(row.tank_capacity),
    currentFuel: Number(row.current_fuel),
    fuelGrade: row.fuel_grade as AtcFuelGrade,
    consumptionRate: Number(row.consumption_rate),
    lastRefuelAt: row.last_refuel_at,
    lastSyncAt: row.last_sync_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertFuelParams {
  tankCapacity?: number | undefined
  currentFuel?: number | undefined
  fuelGrade?: AtcFuelGrade | undefined
  consumptionRate?: number | undefined
}

export class FuelRepository {
  constructor(private readonly pool: VehicleSimPool) {}

  async upsert(vehicleRuntimeId: string, params: UpsertFuelParams): Promise<AtcVehicleFuel> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_vehicle_fuel
           (id, vehicle_runtime_id, tank_capacity, current_fuel, fuel_grade, consumption_rate, last_sync_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           tank_capacity    = COALESCE(VALUES(tank_capacity), tank_capacity),
           current_fuel     = COALESCE(VALUES(current_fuel), current_fuel),
           fuel_grade       = COALESCE(VALUES(fuel_grade), fuel_grade),
           consumption_rate = COALESCE(VALUES(consumption_rate), consumption_rate),
           last_sync_at     = NOW(3),
           updated_at       = NOW(3)`,
        [
          id,
          vehicleRuntimeId,
          params.tankCapacity ?? 65.00,
          params.currentFuel ?? 65.00,
          params.fuelGrade ?? 'regular',
          params.consumptionRate ?? 0.0100,
        ],
      )
      const [rows] = await conn.execute<FuelRow[]>(
        `SELECT * FROM atc_vehicle_fuel WHERE vehicle_runtime_id = ? LIMIT 1`,
        [vehicleRuntimeId],
      )
      if (!rows[0]) throw new FuelRecordNotFoundError(vehicleRuntimeId)
      return rowToFuel(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByRuntimeId(vehicleRuntimeId: string): Promise<AtcVehicleFuel | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FuelRow[]>(
        `SELECT * FROM atc_vehicle_fuel WHERE vehicle_runtime_id = ? LIMIT 1`,
        [vehicleRuntimeId],
      )
      return rows[0] ? rowToFuel(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async consumeFuel(vehicleRuntimeId: string, amount: number): Promise<AtcVehicleFuel> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<FuelRow[]>(
          `SELECT * FROM atc_vehicle_fuel WHERE vehicle_runtime_id = ? LIMIT 1 FOR UPDATE`,
          [vehicleRuntimeId],
        )
        if (!rows[0]) throw new FuelRecordNotFoundError(vehicleRuntimeId)

        const current = Number(rows[0].current_fuel)
        if (current < amount) throw new FuelTankEmptyError(vehicleRuntimeId, current)

        await conn.execute(
          `UPDATE atc_vehicle_fuel
           SET current_fuel = current_fuel - ?, last_sync_at = NOW(3), updated_at = NOW(3)
           WHERE vehicle_runtime_id = ?`,
          [amount, vehicleRuntimeId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<FuelRow[]>(
        `SELECT * FROM atc_vehicle_fuel WHERE vehicle_runtime_id = ? LIMIT 1`,
        [vehicleRuntimeId],
      )
      if (!rows[0]) throw new FuelRecordNotFoundError(vehicleRuntimeId)
      return rowToFuel(rows[0])
    } finally {
      conn.release()
    }
  }

  async refuel(vehicleRuntimeId: string, amount: number, maxCapacity: number): Promise<AtcVehicleFuel> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<FuelRow[]>(
          `SELECT * FROM atc_vehicle_fuel WHERE vehicle_runtime_id = ? LIMIT 1 FOR UPDATE`,
          [vehicleRuntimeId],
        )
        if (!rows[0]) throw new FuelRecordNotFoundError(vehicleRuntimeId)

        await conn.execute(
          `UPDATE atc_vehicle_fuel
           SET current_fuel  = LEAST(current_fuel + ?, ?),
               last_refuel_at = NOW(3),
               last_sync_at  = NOW(3),
               updated_at    = NOW(3)
           WHERE vehicle_runtime_id = ?`,
          [amount, maxCapacity, vehicleRuntimeId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<FuelRow[]>(
        `SELECT * FROM atc_vehicle_fuel WHERE vehicle_runtime_id = ? LIMIT 1`,
        [vehicleRuntimeId],
      )
      if (!rows[0]) throw new FuelRecordNotFoundError(vehicleRuntimeId)
      return rowToFuel(rows[0])
    } finally {
      conn.release()
    }
  }

  async syncFuel(vehicleRuntimeId: string, currentFuel: number): Promise<AtcVehicleFuel> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_vehicle_fuel
         SET current_fuel = ?, last_sync_at = NOW(3), updated_at = NOW(3)
         WHERE vehicle_runtime_id = ?`,
        [currentFuel, vehicleRuntimeId],
      )
      const [rows] = await conn.execute<FuelRow[]>(
        `SELECT * FROM atc_vehicle_fuel WHERE vehicle_runtime_id = ? LIMIT 1`,
        [vehicleRuntimeId],
      )
      if (!rows[0]) throw new FuelRecordNotFoundError(vehicleRuntimeId)
      return rowToFuel(rows[0])
    } finally {
      conn.release()
    }
  }
}
