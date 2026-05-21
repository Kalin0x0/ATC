import type { AtcEventBus } from '@atc/events'
import type {
  DamageRuntimeRepository,
  AtcVehicleDamageRuntime,
  UpsertDamageParams,
  ApplyDamageParams,
} from './damage-runtime.repository.js'
import type { VehicleSimPool } from './pool.js'

export interface DamageRuntimeDeps {
  damageRepo: DamageRuntimeRepository
  pool: VehicleSimPool
  eventBus: AtcEventBus | undefined
}

export class DamageRuntimeService {
  private readonly damageRepo: DamageRuntimeRepository
  private readonly pool: VehicleSimPool
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: DamageRuntimeDeps) {
    this.damageRepo = deps.damageRepo
    this.pool       = deps.pool
    this.eventBus   = deps.eventBus
  }

  async syncDamage(vehicleRuntimeId: string, damageState: UpsertDamageParams): Promise<AtcVehicleDamageRuntime> {
    return this.damageRepo.upsert(vehicleRuntimeId, damageState)
  }

  async applyDamage(vehicleRuntimeId: string, damageParams: ApplyDamageParams): Promise<AtcVehicleDamageRuntime> {
    return this.damageRepo.applyDamage(vehicleRuntimeId, damageParams)
  }

  async repairVehicle(vehicleRuntimeId: string): Promise<AtcVehicleDamageRuntime> {
    return this.damageRepo.repair(vehicleRuntimeId)
  }
}
