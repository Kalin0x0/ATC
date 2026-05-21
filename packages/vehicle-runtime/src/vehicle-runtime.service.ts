import type {
  AtcVehicle,
  AtcVehicleWithRuntime,
  AtcVehicleCategory,
  AtcImpoundReason,
} from '@atc/shared-types'
import { ATC_VEHICLE_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { VehicleRepository, CreateVehicleParams } from './vehicle.repository.js'
import type { VehicleRuntimeRepository } from './vehicle-runtime.repository.js'
import type { GarageRepository } from './garage.repository.js'
import type { ImpoundRepository } from './impound.repository.js'
import type { VehiclePool } from './pool.js'
import { generateId } from './id.js'
import {
  VehicleNotFoundError,
  VehicleImmutableError,
  VehicleAlreadyImpoundedError,
  VehicleAlreadySpawnedError,
} from './errors.js'

export interface VehicleRuntimeDeps {
  vehicleRepo: VehicleRepository
  runtimeRepo: VehicleRuntimeRepository
  garageRepo: GarageRepository
  impoundRepo: ImpoundRepository
  pool: VehiclePool
  eventBus: AtcEventBus | undefined
}

export interface RegisterVehicleParams extends CreateVehicleParams {}

export interface SpawnVehicleParams {
  spawnedByPrincipalId: string
  x: number
  y: number
  z: number
  heading?: number | undefined
  fuel?: number | undefined
  bodyHealth?: number | undefined
  engineHealth?: number | undefined
}

export interface RetrieveVehicleParams {
  garageId: string
  retrievedByPrincipalId: string
  x: number
  y: number
  z: number
  heading?: number | undefined
}

export interface StoreVehicleParams {
  garageId: string
  storedByPrincipalId: string
  fuel?: number | undefined
  bodyHealth?: number | undefined
  engineHealth?: number | undefined
  lastX?: number | undefined
  lastY?: number | undefined
  lastZ?: number | undefined
  lastHeading?: number | undefined
}

export interface ImpoundVehicleParams {
  impoundedByPrincipalId: string
  reason: AtcImpoundReason
  agencyId?: string | null | undefined
  locationId?: string | null | undefined
  evidenceHold?: boolean | undefined
  fee?: number | undefined
  notes?: string | null | undefined
}

export interface ReleaseVehicleParams {
  releasedByPrincipalId: string
  garageId?: string | null | undefined
  notes?: string | null | undefined
}

export interface RepairVehicleParams {
  repairedByPrincipalId: string
  garageId?: string | null | undefined
}

export interface SyncRuntimeParams {
  x: number
  y: number
  z: number
  heading: number
  fuel?: number | undefined
  bodyHealth?: number | undefined
  engineHealth?: number | undefined
  isLocked?: boolean | undefined
  isEngineOn?: boolean | undefined
  netId?: number | null | undefined
  serverHandle?: number | null | undefined
  mileageDelta?: number | undefined
}

export class VehicleRuntimeService {
  private readonly vehicleRepo: VehicleRepository
  private readonly runtimeRepo: VehicleRuntimeRepository
  private readonly garageRepo: GarageRepository
  private readonly impoundRepo: ImpoundRepository
  private readonly pool: VehiclePool
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: VehicleRuntimeDeps) {
    this.vehicleRepo  = deps.vehicleRepo
    this.runtimeRepo  = deps.runtimeRepo
    this.garageRepo   = deps.garageRepo
    this.impoundRepo  = deps.impoundRepo
    this.pool         = deps.pool
    this.eventBus     = deps.eventBus
  }

  // ── Register ──────────────────────────────────────────────────────────────────

  async registerVehicle(params: RegisterVehicleParams): Promise<AtcVehicle> {
    return this.vehicleRepo.create(params)
  }

  // ── Spawn (direct — not from garage) ─────────────────────────────────────────

  async spawn(vehicleId: string, params: SpawnVehicleParams): Promise<AtcVehicleWithRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      let vehicle: AtcVehicle
      try {
        const [rows] = await conn.execute(
          `SELECT status FROM atc_vehicles WHERE id = ? LIMIT 1 FOR UPDATE`,
          [vehicleId],
        ) as [Array<{ status: string }>, unknown]
        if (!rows[0]) throw new VehicleNotFoundError(vehicleId)
        if (rows[0].status !== 'stored') {
          throw new VehicleImmutableError(vehicleId, rows[0].status, 'spawned')
        }

        // INSERT runtime record (UNIQUE on vehicle_id prevents duplicate spawns)
        try {
          await conn.execute(
            `INSERT INTO atc_vehicle_runtime
               (id, vehicle_id, spawned_by_principal_id, x, y, z, heading,
                fuel, body_health, engine_health, spawned_at, updated_at)
             SELECT ?, ?, ?, ?, ?, ?, ?,
                    fuel, body_health, engine_health, NOW(3), NOW(3)
             FROM atc_vehicles WHERE id = ?`,
            [
              generateId(), vehicleId, params.spawnedByPrincipalId,
              params.x, params.y, params.z, params.heading ?? 0,
              vehicleId,
            ],
          )
        } catch (err: unknown) {
          if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
            throw new VehicleAlreadySpawnedError(vehicleId)
          }
          throw err
        }

        await conn.execute(
          `UPDATE atc_vehicles
           SET status = 'spawned', last_x = ?, last_y = ?, last_z = ?, last_heading = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [params.x, params.y, params.z, params.heading ?? 0, vehicleId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      vehicle = (await this.vehicleRepo.findById(vehicleId))!
      const runtime = await this.runtimeRepo.findByVehicle(vehicleId)

      this.eventBus?.emit(ATC_VEHICLE_EVENTS.VEHICLE_SPAWNED, {
        vehicleId, spawnedByPrincipalId: params.spawnedByPrincipalId,
      }).catch(() => undefined)

      return { vehicle, runtime }
    } finally {
      conn.release()
    }
  }

  // ── Retrieve from garage (atomic spawn + garage record mark) ─────────────────

  async retrieve(vehicleId: string, params: RetrieveVehicleParams): Promise<AtcVehicleWithRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      let vehicle: AtcVehicle
      try {
        // Lock vehicle row
        const [rows] = await conn.execute(
          `SELECT status FROM atc_vehicles WHERE id = ? LIMIT 1 FOR UPDATE`,
          [vehicleId],
        ) as [Array<{ status: string }>, unknown]
        if (!rows[0]) throw new VehicleNotFoundError(vehicleId)
        if (rows[0].status !== 'stored') {
          throw new VehicleImmutableError(vehicleId, rows[0].status, 'spawned')
        }

        // Mark garage record as retrieved (also locks the row)
        await this.garageRepo.retrieve(vehicleId, params.garageId, params.retrievedByPrincipalId, conn)

        // Create runtime record
        try {
          await conn.execute(
            `INSERT INTO atc_vehicle_runtime
               (id, vehicle_id, spawned_by_principal_id, x, y, z, heading,
                fuel, body_health, engine_health, spawned_at, updated_at)
             SELECT ?, ?, ?, ?, ?, ?, ?,
                    fuel, body_health, engine_health, NOW(3), NOW(3)
             FROM atc_vehicles WHERE id = ?`,
            [
              generateId(), vehicleId, params.retrievedByPrincipalId,
              params.x, params.y, params.z, params.heading ?? 0,
              vehicleId,
            ],
          )
        } catch (err: unknown) {
          if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
            throw new VehicleAlreadySpawnedError(vehicleId)
          }
          throw err
        }

        // Transition vehicle: stored → spawned
        await conn.execute(
          `UPDATE atc_vehicles
           SET status = 'spawned', garage_id = NULL,
               last_x = ?, last_y = ?, last_z = ?, last_heading = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [params.x, params.y, params.z, params.heading ?? 0, vehicleId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      vehicle = (await this.vehicleRepo.findById(vehicleId))!
      const runtime = await this.runtimeRepo.findByVehicle(vehicleId)

      this.eventBus?.emit(ATC_VEHICLE_EVENTS.VEHICLE_SPAWNED, {
        vehicleId,
        spawnedByPrincipalId: params.retrievedByPrincipalId,
        fromGarage: params.garageId,
      }).catch(() => undefined)

      return { vehicle, runtime }
    } finally {
      conn.release()
    }
  }

  // ── Store ────────────────────────────────────────────────────────────────────

  async store(vehicleId: string, params: StoreVehicleParams): Promise<AtcVehicle> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute(
          `SELECT status FROM atc_vehicles WHERE id = ? LIMIT 1 FOR UPDATE`,
          [vehicleId],
        ) as [Array<{ status: string }>, unknown]
        if (!rows[0]) throw new VehicleNotFoundError(vehicleId)
        const status = rows[0].status
        if (status !== 'spawned' && status !== 'active') {
          throw new VehicleImmutableError(vehicleId, status, 'stored')
        }

        // Create garage storage record
        await this.garageRepo.store(vehicleId, params.garageId, params.storedByPrincipalId, conn)

        // Update vehicle state
        await conn.execute(
          `UPDATE atc_vehicles
           SET status        = 'stored',
               garage_id     = ?,
               fuel          = COALESCE(?, fuel),
               body_health   = COALESCE(?, body_health),
               engine_health = COALESCE(?, engine_health),
               last_x        = COALESCE(?, last_x),
               last_y        = COALESCE(?, last_y),
               last_z        = COALESCE(?, last_z),
               last_heading  = COALESCE(?, last_heading),
               is_engine_on  = 0,
               updated_at    = NOW(3)
           WHERE id = ?`,
          [
            params.garageId,
            params.fuel ?? null,
            params.bodyHealth ?? null,
            params.engineHealth ?? null,
            params.lastX ?? null,
            params.lastY ?? null,
            params.lastZ ?? null,
            params.lastHeading ?? null,
            vehicleId,
          ],
        )

        // Clean up runtime record
        await conn.execute(
          `DELETE FROM atc_vehicle_runtime WHERE vehicle_id = ?`,
          [vehicleId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const vehicle = await this.vehicleRepo.findById(vehicleId)
      if (!vehicle) throw new VehicleNotFoundError(vehicleId)

      this.eventBus?.emit(ATC_VEHICLE_EVENTS.VEHICLE_STORED, {
        vehicleId, storedByPrincipalId: params.storedByPrincipalId, garageId: params.garageId,
      }).catch(() => undefined)

      return vehicle
    } finally {
      conn.release()
    }
  }

  // ── Impound ───────────────────────────────────────────────────────────────────

  async impound(vehicleId: string, params: ImpoundVehicleParams): Promise<AtcVehicle> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute(
          `SELECT status FROM atc_vehicles WHERE id = ? LIMIT 1 FOR UPDATE`,
          [vehicleId],
        ) as [Array<{ status: string }>, unknown]
        if (!rows[0]) throw new VehicleNotFoundError(vehicleId)
        if (rows[0].status === 'impounded') throw new VehicleAlreadyImpoundedError(vehicleId)
        if (rows[0].status === 'destroyed') {
          throw new VehicleImmutableError(vehicleId, rows[0].status, 'impounded')
        }

        // Create impound record
        await this.impoundRepo.create({
          vehicleId,
          reason: params.reason,
          impoundedByPrincipalId: params.impoundedByPrincipalId,
          agencyId: params.agencyId,
          locationId: params.locationId,
          evidenceHold: params.evidenceHold,
          fee: params.fee,
          notes: params.notes,
        }, conn)

        // Update vehicle
        await conn.execute(
          `UPDATE atc_vehicles
           SET status = 'impounded', garage_id = NULL, is_engine_on = 0, updated_at = NOW(3)
           WHERE id = ?`,
          [vehicleId],
        )

        // Clean up runtime record if vehicle was spawned/active
        await conn.execute(
          `DELETE FROM atc_vehicle_runtime WHERE vehicle_id = ?`,
          [vehicleId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const vehicle = await this.vehicleRepo.findById(vehicleId)
      if (!vehicle) throw new VehicleNotFoundError(vehicleId)

      this.eventBus?.emit(ATC_VEHICLE_EVENTS.VEHICLE_IMPOUNDED, {
        vehicleId,
        impoundedByPrincipalId: params.impoundedByPrincipalId,
        reason: params.reason,
      }).catch(() => undefined)

      return vehicle
    } finally {
      conn.release()
    }
  }

  // ── Release from impound ──────────────────────────────────────────────────────

  async release(vehicleId: string, params: ReleaseVehicleParams): Promise<AtcVehicle> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute(
          `SELECT status FROM atc_vehicles WHERE id = ? LIMIT 1 FOR UPDATE`,
          [vehicleId],
        ) as [Array<{ status: string }>, unknown]
        if (!rows[0]) throw new VehicleNotFoundError(vehicleId)
        if (rows[0].status !== 'impounded') {
          throw new VehicleImmutableError(vehicleId, rows[0].status, 'stored')
        }

        // Release the impound record (checks evidence hold internally)
        await this.impoundRepo.release(vehicleId, params.releasedByPrincipalId, params.notes, conn)

        // Transition vehicle to stored
        await conn.execute(
          `UPDATE atc_vehicles
           SET status = 'stored',
               garage_id = COALESCE(?, garage_id),
               updated_at = NOW(3)
           WHERE id = ?`,
          [params.garageId ?? null, vehicleId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const vehicle = await this.vehicleRepo.findById(vehicleId)
      if (!vehicle) throw new VehicleNotFoundError(vehicleId)

      this.eventBus?.emit(ATC_VEHICLE_EVENTS.VEHICLE_RELEASED, {
        vehicleId, releasedByPrincipalId: params.releasedByPrincipalId,
      }).catch(() => undefined)

      return vehicle
    } finally {
      conn.release()
    }
  }

  // ── Repair (destroyed → stored) ───────────────────────────────────────────────

  async repair(vehicleId: string, params: RepairVehicleParams): Promise<AtcVehicle> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute(
          `SELECT status FROM atc_vehicles WHERE id = ? LIMIT 1 FOR UPDATE`,
          [vehicleId],
        ) as [Array<{ status: string }>, unknown]
        if (!rows[0]) throw new VehicleNotFoundError(vehicleId)
        if (rows[0].status !== 'destroyed') {
          throw new VehicleImmutableError(vehicleId, rows[0].status, 'stored')
        }

        if (params.garageId) {
          await this.garageRepo.store(vehicleId, params.garageId, params.repairedByPrincipalId, conn)
        }

        await conn.execute(
          `UPDATE atc_vehicles
           SET status = 'stored', body_health = 1000, engine_health = 1000, fuel = 100,
               garage_id = COALESCE(?, garage_id), updated_at = NOW(3)
           WHERE id = ?`,
          [params.garageId ?? null, vehicleId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const vehicle = await this.vehicleRepo.findById(vehicleId)
      if (!vehicle) throw new VehicleNotFoundError(vehicleId)

      this.eventBus?.emit(ATC_VEHICLE_EVENTS.VEHICLE_STORED, {
        vehicleId, storedByPrincipalId: params.repairedByPrincipalId, repaired: true,
      }).catch(() => undefined)

      return vehicle
    } finally {
      conn.release()
    }
  }

  // ── Destroy ────────────────────────────────────────────────────────────────────

  async destroy(vehicleId: string, principalId: string): Promise<AtcVehicle> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute(
          `SELECT status FROM atc_vehicles WHERE id = ? LIMIT 1 FOR UPDATE`,
          [vehicleId],
        ) as [Array<{ status: string }>, unknown]
        if (!rows[0]) throw new VehicleNotFoundError(vehicleId)
        const st = rows[0].status
        if (st !== 'spawned' && st !== 'active') {
          throw new VehicleImmutableError(vehicleId, st, 'destroyed')
        }

        await conn.execute(
          `UPDATE atc_vehicles
           SET status = 'destroyed', body_health = 0, is_engine_on = 0, updated_at = NOW(3)
           WHERE id = ?`,
          [vehicleId],
        )
        await conn.execute(
          `DELETE FROM atc_vehicle_runtime WHERE vehicle_id = ?`,
          [vehicleId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const vehicle = await this.vehicleRepo.findById(vehicleId)
      if (!vehicle) throw new VehicleNotFoundError(vehicleId)

      this.eventBus?.emit(ATC_VEHICLE_EVENTS.VEHICLE_DESTROYED, { vehicleId, principalId })
        .catch(() => undefined)

      return vehicle
    } finally {
      conn.release()
    }
  }

  // ── Runtime sync ──────────────────────────────────────────────────────────────

  async syncRuntime(vehicleId: string, updates: SyncRuntimeParams): Promise<void> {
    await Promise.all([
      this.runtimeRepo.update({ vehicleId, ...updates }),
      this.vehicleRepo.updateRuntimeSnapshot({ vehicleId, ...updates }),
    ])
  }

  // ── Queries ───────────────────────────────────────────────────────────────────

  async findById(vehicleId: string): Promise<AtcVehicleWithRuntime | null> {
    const vehicle = await this.vehicleRepo.findById(vehicleId)
    if (!vehicle) return null
    const runtime = await this.runtimeRepo.findByVehicle(vehicleId)
    return { vehicle, runtime }
  }

  async listByOwner(ownerId: string): Promise<AtcVehicle[]> {
    return this.vehicleRepo.listByOwner(ownerId)
  }

  async listByOrganization(organizationId: string): Promise<AtcVehicle[]> {
    return this.vehicleRepo.listByOrganization(organizationId)
  }

}
