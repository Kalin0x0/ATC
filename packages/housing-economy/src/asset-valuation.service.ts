import type { AtcEventBus } from '@atc/events'
import type {
  AssetValuationRepository,
  AtcAssetValuation,
  RecordValuationParams,
} from './asset-valuation.repository.js'

export class AssetValuationService {
  constructor(
    private readonly valuationRepo: AssetValuationRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async recordValuation(params: RecordValuationParams): Promise<AtcAssetValuation> {
    const valuation = await this.valuationRepo.record(params)

    this.eventBus
      .emit('atc:housing:valuation:recorded', {
        valuationId: valuation.id,
        propertyId: valuation.propertyId,
        valuationAmount: valuation.valuationAmount.toString(),
        previousAmount: valuation.previousAmount?.toString() ?? null,
        method: valuation.method,
        valuedAt: valuation.valuedAt.toISOString(),
      })
      .catch(() => undefined)

    return valuation
  }

  async getLatestValuation(propertyId: string): Promise<AtcAssetValuation | null> {
    return this.valuationRepo.findLatestByProperty(propertyId)
  }
}
