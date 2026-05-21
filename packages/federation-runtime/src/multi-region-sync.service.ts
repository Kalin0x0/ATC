import type { RegionRuntimeRepository, AtcRegionRuntime, UpsertRegionParams } from './region-runtime.repository.js'
import type { FederationRuntimeEventBus } from './federation-recovery.service.js'

export class MultiRegionSyncService {
  constructor(
    private regionRepo: RegionRuntimeRepository,
    private eventBus: FederationRuntimeEventBus,
  ) {}

  async syncRegion(params: UpsertRegionParams): Promise<AtcRegionRuntime> {
    const region = await this.regionRepo.upsert(params)
    this.eventBus.emit('atc:federation:region:synchronized', { regionId: region.regionId }).catch(() => undefined)
    return region
  }

  async getRegionState(regionId: string): Promise<AtcRegionRuntime | null> {
    return this.regionRepo.findByRegion(regionId)
  }

  async deactivateRegion(regionId: string): Promise<void> {
    await this.regionRepo.deactivate(regionId)
    this.eventBus.emit('atc:federation:region:deactivated', { regionId }).catch(() => undefined)
  }
}
