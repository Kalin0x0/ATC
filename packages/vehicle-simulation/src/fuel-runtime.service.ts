import type { AtcEventBus } from '@atc/events'
import type { FuelRepository, AtcVehicleFuel } from './fuel.repository.js'
import type { VehicleSimPool } from './pool.js'

export interface FuelRuntimeDeps {
  fuelRepo: FuelRepository
  pool: VehicleSimPool
  eventBus: AtcEventBus | undefined
}

export class FuelRuntimeService {
  private readonly fuelRepo: FuelRepository
  private readonly pool: VehicleSimPool
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: FuelRuntimeDeps) {
    this.fuelRepo = deps.fuelRepo
    this.pool     = deps.pool
    this.eventBus = deps.eventBus
  }

  async syncFuel(vehicleRuntimeId: string, currentFuel: number): Promise<AtcVehicleFuel> {
    return this.fuelRepo.syncFuel(vehicleRuntimeId, currentFuel)
  }

  async consumeFuel(vehicleRuntimeId: string, amount: number): Promise<AtcVehicleFuel> {
    return this.fuelRepo.consumeFuel(vehicleRuntimeId, amount)
  }

  async refuel(vehicleRuntimeId: string, amount: number, maxCapacity: number): Promise<AtcVehicleFuel> {
    return this.fuelRepo.refuel(vehicleRuntimeId, amount, maxCapacity)
  }
}
