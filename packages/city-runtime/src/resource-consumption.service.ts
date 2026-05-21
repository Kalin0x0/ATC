import type { AtcEventBus } from '@atc/events'
import type {
  ResourceConsumptionRepository,
  AtcResourceConsumption,
  AtcResourceType,
} from './resource-consumption.repository.js'

export class ResourceConsumptionService {
  constructor(
    private readonly consumptionRepo: ResourceConsumptionRepository,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async recordConsumption(
    gridId: string,
    resourceType: AtcResourceType,
    amount: number,
    consumerId?: string | undefined,
    periodLabel?: string | undefined,
  ): Promise<AtcResourceConsumption> {
    const record = await this.consumptionRepo.record(
      gridId,
      resourceType,
      amount,
      consumerId,
      periodLabel,
    )

    this.eventBus?.emit('atc:city:resource_consumed', {
      gridId: record.gridId,
      resourceType: record.resourceType,
      amount: record.amount,
      consumerId: record.consumerId,
      periodLabel: record.periodLabel,
    }).catch(() => undefined)

    return record
  }

  async getConsumptionByGrid(
    gridId: string,
    limit?: number | undefined,
  ): Promise<AtcResourceConsumption[]> {
    return this.consumptionRepo.listByGrid(gridId, limit)
  }
}
