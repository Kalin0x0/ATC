import type { AtcEventBus } from '@atc/events'
import type { PopulationZoneRepository, AtcPopulationZone } from './population-zone.repository.js'
import type { NpcRuntimeRepository } from './npc-runtime.repository.js'

export class CivilianPopulationService {
  constructor(
    private readonly zoneRepo: PopulationZoneRepository,
    private readonly npcRepo: NpcRuntimeRepository,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async updatePopulation(
    zoneId: string,
    current: number,
    max: number,
  ): Promise<AtcPopulationZone> {
    const zone = await this.zoneRepo.upsertPopulation(zoneId, current, max)

    this.eventBus?.emit('atc:npc:population_updated', {
      zoneId: zone.zoneId,
      currentPopulation: zone.currentPopulation,
      maxPopulation: zone.maxPopulation,
    }).catch(() => undefined)

    return zone
  }

  async getPopulation(zoneId: string): Promise<AtcPopulationZone | null> {
    return this.zoneRepo.findByZoneId(zoneId)
  }

  async listActiveZones(): Promise<AtcPopulationZone[]> {
    return this.zoneRepo.listActive()
  }
}
