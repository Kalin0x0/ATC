import type { AtcEventBus } from '@atc/events'
import type { ManufacturingQueueRepository } from './manufacturing-queue.repository.js'
import type { AtcManufacturingQueue, AtcQueueStatus } from './manufacturing-queue.repository.js'

export class ManufacturingQueueService {
  constructor(
    private readonly queueRepo: ManufacturingQueueRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async registerStation(stationId: string, stationType: string): Promise<AtcManufacturingQueue> {
    return this.queueRepo.upsert(stationId, stationType)
  }

  async updateQueueStatus(
    stationId: string,
    status: AtcQueueStatus,
    opts?: { currentJobId?: string | null; operatorPrincipalId?: string | null },
  ): Promise<AtcManufacturingQueue> {
    const queue = await this.queueRepo.updateStatus(
      stationId,
      status,
      opts?.currentJobId,
      opts?.operatorPrincipalId,
    )
    this.eventBus.emit('atc:crafting:queue:status_changed', { stationId, status }).catch(() => undefined)
    return queue
  }

  async getQueue(stationId: string): Promise<AtcManufacturingQueue | null> {
    return this.queueRepo.findByStationId(stationId)
  }
}
