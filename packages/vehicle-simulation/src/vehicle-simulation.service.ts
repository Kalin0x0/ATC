import type { AtcEventBus } from '@atc/events'
import type { FuelRepository, AtcVehicleFuel } from './fuel.repository.js'
import type { DamageRuntimeRepository, AtcVehicleDamageRuntime, UpsertDamageParams } from './damage-runtime.repository.js'
import type { RuntimeMetricsRepository, AtcVehicleRuntimeMetrics } from './runtime-metrics.repository.js'
import type { FuelRuntimeService } from './fuel-runtime.service.js'
import type { DamageRuntimeService } from './damage-runtime.service.js'
import type { VehicleSimPool } from './pool.js'

export interface HeartbeatData {
  currentFuel: number
  distanceDelta: number
  topSpeed: number
  collisionDelta: number
  engineMinutes: number
  damageState?: UpsertDamageParams | undefined
}

export interface VehicleSimState {
  fuel: AtcVehicleFuel | null
  damage: AtcVehicleDamageRuntime | null
  metrics: AtcVehicleRuntimeMetrics | null
}

export interface VehicleSimulationDeps {
  fuelRepo: FuelRepository
  damageRepo: DamageRuntimeRepository
  metricsRepo: RuntimeMetricsRepository
  fuelService: FuelRuntimeService
  damageService: DamageRuntimeService
  pool: VehicleSimPool
  eventBus: AtcEventBus | undefined
}

export class VehicleSimulationService {
  private readonly fuelRepo: FuelRepository
  private readonly damageRepo: DamageRuntimeRepository
  private readonly metricsRepo: RuntimeMetricsRepository
  private readonly fuelService: FuelRuntimeService
  private readonly damageService: DamageRuntimeService

  constructor(deps: VehicleSimulationDeps) {
    this.fuelRepo      = deps.fuelRepo
    this.damageRepo    = deps.damageRepo
    this.metricsRepo   = deps.metricsRepo
    this.fuelService   = deps.fuelService
    this.damageService = deps.damageService
  }

  async heartbeat(vehicleRuntimeId: string, heartbeatData: HeartbeatData): Promise<void> {
    await Promise.all([
      this.metricsRepo.recordHeartbeat(
        vehicleRuntimeId,
        heartbeatData.distanceDelta,
        heartbeatData.topSpeed,
        heartbeatData.collisionDelta,
        heartbeatData.engineMinutes,
      ),
      this.fuelService.syncFuel(vehicleRuntimeId, heartbeatData.currentFuel),
      heartbeatData.damageState !== undefined
        ? this.damageService.syncDamage(vehicleRuntimeId, heartbeatData.damageState)
        : Promise.resolve(),
    ])
  }

  async getVehicleSimState(vehicleRuntimeId: string): Promise<VehicleSimState> {
    const [fuel, damage, metrics] = await Promise.all([
      this.fuelRepo.findByRuntimeId(vehicleRuntimeId),
      this.damageRepo.findByRuntimeId(vehicleRuntimeId),
      this.metricsRepo.findByRuntimeId(vehicleRuntimeId),
    ])
    return { fuel, damage, metrics }
  }
}
