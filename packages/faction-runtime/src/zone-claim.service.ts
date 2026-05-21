import type { AtcEventBus } from '@atc/events'
import type { FactionPool } from './pool.js'
import { TerritoryClaimRepository, type AtcTerritoryClaim } from './territory-claim.repository.js'
import { TerritoryRepository } from './territory.repository.js'

export class ZoneClaimService {
  private readonly claimRepo: TerritoryClaimRepository
  private readonly territoryRepo: TerritoryRepository

  constructor(
    private readonly pool: FactionPool,
    private readonly eventBus: AtcEventBus,
  ) {
    this.claimRepo = new TerritoryClaimRepository(pool)
    this.territoryRepo = new TerritoryRepository(pool)
  }

  async getActiveClaim(territoryId: string): Promise<AtcTerritoryClaim | null> {
    const territory = await this.territoryRepo.findByTerritoryId(territoryId)
    if (!territory) return null
    return this.claimRepo.findActiveClaim(territory.id)
  }

  async listFactionClaims(factionId: string): Promise<AtcTerritoryClaim[]> {
    const all = await this.claimRepo.listByFaction(factionId)
    return all.filter((c) => c.status === 'active')
  }

  async bulkReleaseClaims(factionId: string): Promise<void> {
    const claims = await this.claimRepo.listByFaction(factionId)
    const active = claims.filter((c) => c.status === 'active')
    await Promise.all(
      active.map((claim) =>
        this.claimRepo.transition(claim.id, 'released', { notes: 'Bulk release on faction disband' }),
      ),
    )
  }
}
