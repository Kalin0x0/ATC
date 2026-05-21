import type { RowDataPacket } from 'mysql2/promise'
import type { VehicleSimPool } from './pool.js'
import { generateId } from './id.js'
import { DamageRecordNotFoundError } from './errors.js'

export type AtcTireState = 'intact' | 'punctured' | 'burst'

export interface AtcTireStateMap {
  fl: AtcTireState
  fr: AtcTireState
  rl: AtcTireState
  rr: AtcTireState
}

export interface AtcVehicleDamageRuntime {
  id: string
  vehicleRuntimeId: string
  engineHealth: number
  bodyHealth: number
  fuelTankHealth: number
  panelDamage: Record<string, number>
  tireState: AtcTireStateMap
  isEngineDestroyed: boolean
  isOnFire: boolean
  lastSyncAt: Date
  updatedAt: Date
}

interface DamageRow extends RowDataPacket {
  id: string
  vehicle_runtime_id: string
  engine_health: number
  body_health: number
  fuel_tank_health: number
  panel_damage: string
  tire_state: string
  is_engine_destroyed: number
  is_on_fire: number
  last_sync_at: Date
  updated_at: Date
}

function rowToDamage(row: DamageRow): AtcVehicleDamageRuntime {
  return {
    id: row.id,
    vehicleRuntimeId: row.vehicle_runtime_id,
    engineHealth: Number(row.engine_health),
    bodyHealth: Number(row.body_health),
    fuelTankHealth: Number(row.fuel_tank_health),
    panelDamage: typeof row.panel_damage === 'string'
      ? (JSON.parse(row.panel_damage) as Record<string, number>)
      : (row.panel_damage as unknown as Record<string, number>),
    tireState: typeof row.tire_state === 'string'
      ? (JSON.parse(row.tire_state) as AtcTireStateMap)
      : (row.tire_state as unknown as AtcTireStateMap),
    isEngineDestroyed: row.is_engine_destroyed === 1,
    isOnFire: row.is_on_fire === 1,
    lastSyncAt: row.last_sync_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertDamageParams {
  engineHealth?: number | undefined
  bodyHealth?: number | undefined
  fuelTankHealth?: number | undefined
  panelDamage?: Record<string, number> | undefined
  tireState?: Partial<AtcTireStateMap> | undefined
  isEngineDestroyed?: boolean | undefined
  isOnFire?: boolean | undefined
}

export interface ApplyDamageParams {
  engineDelta?: number | undefined
  bodyDelta?: number | undefined
  fuelTankDelta?: number | undefined
  panelDamage?: Record<string, number> | undefined
  tireState?: Partial<AtcTireStateMap> | undefined
  isEngineDestroyed?: boolean | undefined
  isOnFire?: boolean | undefined
}

export class DamageRuntimeRepository {
  constructor(private readonly pool: VehicleSimPool) {}

  async upsert(vehicleRuntimeId: string, params: UpsertDamageParams): Promise<AtcVehicleDamageRuntime> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      const panelDamage = JSON.stringify(params.panelDamage ?? {})
      const tireState = JSON.stringify(
        params.tireState ?? { fl: 'intact', fr: 'intact', rl: 'intact', rr: 'intact' },
      )
      await conn.execute(
        `INSERT INTO atc_vehicle_damage_runtime
           (id, vehicle_runtime_id, engine_health, body_health, fuel_tank_health,
            panel_damage, tire_state, is_engine_destroyed, is_on_fire, last_sync_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           engine_health      = VALUES(engine_health),
           body_health        = VALUES(body_health),
           fuel_tank_health   = VALUES(fuel_tank_health),
           panel_damage       = VALUES(panel_damage),
           tire_state         = VALUES(tire_state),
           is_engine_destroyed = VALUES(is_engine_destroyed),
           is_on_fire         = VALUES(is_on_fire),
           last_sync_at       = NOW(3),
           updated_at         = NOW(3)`,
        [
          id,
          vehicleRuntimeId,
          params.engineHealth ?? 1000.00,
          params.bodyHealth ?? 1000.00,
          params.fuelTankHealth ?? 1000.00,
          panelDamage,
          tireState,
          params.isEngineDestroyed ? 1 : 0,
          params.isOnFire ? 1 : 0,
        ],
      )
      const [rows] = await conn.execute<DamageRow[]>(
        `SELECT * FROM atc_vehicle_damage_runtime WHERE vehicle_runtime_id = ? LIMIT 1`,
        [vehicleRuntimeId],
      )
      if (!rows[0]) throw new DamageRecordNotFoundError(vehicleRuntimeId)
      return rowToDamage(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByRuntimeId(vehicleRuntimeId: string): Promise<AtcVehicleDamageRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DamageRow[]>(
        `SELECT * FROM atc_vehicle_damage_runtime WHERE vehicle_runtime_id = ? LIMIT 1`,
        [vehicleRuntimeId],
      )
      return rows[0] ? rowToDamage(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async applyDamage(vehicleRuntimeId: string, damageParams: ApplyDamageParams): Promise<AtcVehicleDamageRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<DamageRow[]>(
          `SELECT * FROM atc_vehicle_damage_runtime WHERE vehicle_runtime_id = ? LIMIT 1 FOR UPDATE`,
          [vehicleRuntimeId],
        )
        if (!rows[0]) throw new DamageRecordNotFoundError(vehicleRuntimeId)

        const current = rowToDamage(rows[0])

        const newEngineHealth = Math.max(0, current.engineHealth - (damageParams.engineDelta ?? 0))
        const newBodyHealth = Math.max(0, current.bodyHealth - (damageParams.bodyDelta ?? 0))
        const newFuelTankHealth = Math.max(0, current.fuelTankHealth - (damageParams.fuelTankDelta ?? 0))

        const mergedPanelDamage = { ...current.panelDamage, ...(damageParams.panelDamage ?? {}) }
        const mergedTireState = { ...current.tireState, ...(damageParams.tireState ?? {}) }

        const isEngineDestroyed = damageParams.isEngineDestroyed !== undefined
          ? damageParams.isEngineDestroyed
          : (current.isEngineDestroyed || newEngineHealth <= 0)
        const isOnFire = damageParams.isOnFire !== undefined ? damageParams.isOnFire : current.isOnFire

        await conn.execute(
          `UPDATE atc_vehicle_damage_runtime
           SET engine_health       = ?,
               body_health         = ?,
               fuel_tank_health    = ?,
               panel_damage        = ?,
               tire_state          = ?,
               is_engine_destroyed = ?,
               is_on_fire          = ?,
               last_sync_at        = NOW(3),
               updated_at          = NOW(3)
           WHERE vehicle_runtime_id = ?`,
          [
            newEngineHealth,
            newBodyHealth,
            newFuelTankHealth,
            JSON.stringify(mergedPanelDamage),
            JSON.stringify(mergedTireState),
            isEngineDestroyed ? 1 : 0,
            isOnFire ? 1 : 0,
            vehicleRuntimeId,
          ],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<DamageRow[]>(
        `SELECT * FROM atc_vehicle_damage_runtime WHERE vehicle_runtime_id = ? LIMIT 1`,
        [vehicleRuntimeId],
      )
      if (!rows[0]) throw new DamageRecordNotFoundError(vehicleRuntimeId)
      return rowToDamage(rows[0])
    } finally {
      conn.release()
    }
  }

  async repair(vehicleRuntimeId: string): Promise<AtcVehicleDamageRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_vehicle_damage_runtime
         SET engine_health       = 1000.00,
             body_health         = 1000.00,
             fuel_tank_health    = 1000.00,
             panel_damage        = '{}',
             tire_state          = '{"fl":"intact","fr":"intact","rl":"intact","rr":"intact"}',
             is_engine_destroyed = 0,
             is_on_fire          = 0,
             last_sync_at        = NOW(3),
             updated_at          = NOW(3)
         WHERE vehicle_runtime_id = ?`,
        [vehicleRuntimeId],
      )
      const [rows] = await conn.execute<DamageRow[]>(
        `SELECT * FROM atc_vehicle_damage_runtime WHERE vehicle_runtime_id = ? LIMIT 1`,
        [vehicleRuntimeId],
      )
      if (!rows[0]) throw new DamageRecordNotFoundError(vehicleRuntimeId)
      return rowToDamage(rows[0])
    } finally {
      conn.release()
    }
  }
}
