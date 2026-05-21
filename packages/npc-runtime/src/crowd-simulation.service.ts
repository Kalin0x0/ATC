import type { AtcEventBus } from '@atc/events'
import type { CrowdRuntimeRepository, AtcCrowdRuntime } from './crowd-runtime.repository.js'
import type { PopulationZoneRepository } from './population-zone.repository.js'

export class CrowdSimulationService {
  constructor(
    private readonly crowdRepo: CrowdRuntimeRepository,
    private readonly zoneRepo: PopulationZoneRepository,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async updateDensity(
    zoneId: string,
    density: number,
    targetDensity: number,
    activeNpcCount: number,
  ): Promise<AtcCrowdRuntime> {
    const crowd = await this.crowdRepo.upsert(zoneId, density, targetDensity, activeNpcCount)

    if (density > 0.8) {
      this.eventBus?.emit('atc:npc:crowd_density_changed', {
        zoneId,
        density,
        targetDensity,
        activeNpcCount,
      }).catch(() => undefined)
    }

    return crowd
  }

  async getCrowd(zoneId: string): Promise<AtcCrowdRuntime | null> {
    return this.crowdRepo.findByZone(zoneId)
  }

  async listAll(): Promise<AtcCrowdRuntime[]> {
    return this.crowdRepo.listAll()
  }
}
