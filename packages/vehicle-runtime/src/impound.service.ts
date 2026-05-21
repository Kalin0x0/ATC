import type { AtcVehicleImpound } from '@atc/shared-types'
import type { ImpoundRepository } from './impound.repository.js'

export interface ImpoundServiceDeps {
  impoundRepo: ImpoundRepository
}

export class ImpoundService {
  private readonly impoundRepo: ImpoundRepository

  constructor(deps: ImpoundServiceDeps) {
    this.impoundRepo = deps.impoundRepo
  }

  async getActiveImpound(vehicleId: string): Promise<AtcVehicleImpound | null> {
    return this.impoundRepo.findActiveForVehicle(vehicleId)
  }

  async listByVehicle(vehicleId: string): Promise<AtcVehicleImpound[]> {
    return this.impoundRepo.listByVehicle(vehicleId)
  }
}
