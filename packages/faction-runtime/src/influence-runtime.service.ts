import type { AtcEventBus } from '@atc/events'
import type { FactionPool } from './pool.js'
import { InfluenceRuntimeRepository, type AtcInfluenceRecord } from './influence-runtime.repository.js'
import { TerritoryRepository } from './territory.repository.js'

const DOMINANT_THRESHOLD = 75
const ADJACENCY_BONUS = 5

export class InfluenceRuntimeService {
  private readonly influenceRepo: InfluenceRuntimeRepository
  private readonly territoryRepo: TerritoryRepository

  constructor(
    private readonly pool: FactionPool,
    private readonly eventBus: AtcEventBus,
  ) {
    this.influenceRepo = new InfluenceRuntimeRepository(pool)
    this.territoryRepo = new TerritoryRepository(pool)
  }

  async addInfluence(factionId: string, territoryId: string, amount: number): Promise<AtcInfluenceRecord> {
    const record = await this.influenceRepo.addInfluence(factionId, territoryId, amount)

    if (record.influenceScore >= DOMINANT_THRESHOLD) {
      const territory = await this.territoryRepo.findById(territoryId)
      if (territory && territory.controllingFactionId !== factionId) {
        await this.territoryRepo.setController(territoryId, factionId)
        this.eventBus.emit('atc:faction:territory:claimed', {
          territoryId,
          factionId,
          claimId: null,
        }).catch(() => undefined)
      }
    }

    return record
  }

  async applyDecayTick(territoryId: string): Promise<void> {
    const records = await this.influenceRepo.listByTerritory(territoryId)
    if (records.length === 0) return
    const decayAmount = records[0]?.decayRate ?? 0.01
    await this.influenceRepo.applyDecay(territoryId, decayAmount)
  }

  async getTopFaction(territoryId: string): Promise<AtcInfluenceRecord | null> {
    return this.influenceRepo.getTopFaction(territoryId)
  }

  async propagateInfluence(factionId: string, capturedTerritoryId: string): Promise<void> {
    const allTerritories = await this.territoryRepo.listAll()
    const captured = allTerritories.find((t) => t.id === capturedTerritoryId)
    if (!captured) return

    for (const territory of allTerritories) {
      if (territory.id === capturedTerritoryId) continue
      if (territory.controllingFactionId === factionId) {
        await this.influenceRepo.addInfluence(factionId, territory.id, ADJACENCY_BONUS)
      }
    }
  }
}
