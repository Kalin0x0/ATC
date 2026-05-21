import type { AtcVehicleGarageRecord, AtcGarageSummary } from '@atc/shared-types'
import type { GarageRepository } from './garage.repository.js'

export interface GarageServiceDeps {
  garageRepo: GarageRepository
}

export class GarageService {
  private readonly garageRepo: GarageRepository

  constructor(deps: GarageServiceDeps) {
    this.garageRepo = deps.garageRepo
  }

  async listVehicles(garageId: string): Promise<AtcVehicleGarageRecord[]> {
    return this.garageRepo.listActiveByGarage(garageId)
  }

  async listGarages(): Promise<AtcGarageSummary[]> {
    return this.garageRepo.listGarages()
  }

  async findActiveForVehicle(vehicleId: string): Promise<AtcVehicleGarageRecord | null> {
    return this.garageRepo.findActiveForVehicle(vehicleId)
  }
}
