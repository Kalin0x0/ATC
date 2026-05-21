import type { InflationRuntimeRepository, AtcInflationRuntime, UpsertInflationParams } from './inflation-runtime.repository.js'
import type { EconomyRegulationEventBus } from './economic-recovery.service.js'

export class InflationControlService {
  constructor(
    private inflationRepo: InflationRuntimeRepository,
    private eventBus: EconomyRegulationEventBus,
  ) {}

  async upsertInflation(params: UpsertInflationParams): Promise<AtcInflationRuntime> {
    const inflation = await this.inflationRepo.upsert(params)
    this.eventBus.emit('atc:economy:inflation:updated', { inflation }).catch(() => undefined)
    return inflation
  }

  async getInflation(regionId: string): Promise<AtcInflationRuntime | null> {
    return this.inflationRepo.findByRegion(regionId)
  }

  async deactivateInflation(regionId: string): Promise<void> {
    await this.inflationRepo.deactivate(regionId)
    this.eventBus.emit('atc:economy:inflation:deactivated', { regionId }).catch(() => undefined)
  }
}
