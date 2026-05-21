import type { AtcEventBus } from '@atc/events'
import type { FactionPool } from './pool.js'
import { FactionRepository } from './faction.repository.js'
import { TerritoryRepository, type AtcTerritory } from './territory.repository.js'
import { TerritoryClaimRepository, type AtcTerritoryClaim, type AtcClaimType } from './territory-claim.repository.js'
import { InfluenceRuntimeRepository } from './influence-runtime.repository.js'
import { TerritoryNotFoundError, FactionNotFoundError } from './errors.js'

export class TerritoryControlService {
  private readonly territoryRepo: TerritoryRepository
  private readonly claimRepo: TerritoryClaimRepository
  private readonly factionRepo: FactionRepository
  private readonly influenceRepo: InfluenceRuntimeRepository

  constructor(
    private readonly pool: FactionPool,
    private readonly eventBus: AtcEventBus,
  ) {
    this.territoryRepo = new TerritoryRepository(pool)
    this.claimRepo = new TerritoryClaimRepository(pool)
    this.factionRepo = new FactionRepository(pool)
    this.influenceRepo = new InfluenceRuntimeRepository(pool)
  }

  async claimTerritory(
    territoryId: string,
    factionId: string,
    claimedByPrincipalId: string,
    claimNonce: string,
    claimType?: AtcClaimType,
  ): Promise<AtcTerritoryClaim> {
    const territory = await this.territoryRepo.findByTerritoryId(territoryId)
    if (!territory) throw new TerritoryNotFoundError(territoryId)

    const faction = await this.factionRepo.findById(factionId)
    if (!faction) throw new FactionNotFoundError(factionId)

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      const existingClaim = await this.claimRepo.findActiveClaim(territory.id)
      if (existingClaim) {
        await this.claimRepo.transition(existingClaim.id, 'superseded', { notes: `Superseded by faction ${factionId}` })
        if (existingClaim.factionId !== factionId) {
          await this.factionRepo.decrementTerritoryCount(existingClaim.factionId, conn)
        }
      }

      const claim = await this.claimRepo.create({
        territoryId: territory.id,
        factionId,
        claimedByPrincipalId,
        claimType: claimType ?? 'capture',
        claimNonce,
      })

      await this.territoryRepo.setController(territory.id, factionId, conn)
      await this.factionRepo.incrementTerritoryCount(factionId, conn)

      await conn.commit()

      this.eventBus.emit('atc:faction:territory:claimed', {
        territoryId: territory.id,
        factionId,
        claimId: claim.id,
      }).catch(() => undefined)

      return claim
    } catch (err) {
      try { await conn.rollback() } catch { /* ignore */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async releaseTerritory(territoryId: string, factionId: string): Promise<void> {
    const territory = await this.territoryRepo.findByTerritoryId(territoryId)
    if (!territory) throw new TerritoryNotFoundError(territoryId)

    const activeClaim = await this.claimRepo.findActiveClaim(territory.id)
    if (activeClaim && activeClaim.factionId === factionId) {
      await this.claimRepo.transition(activeClaim.id, 'released')
    }

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      await this.territoryRepo.clearController(territory.id, conn)
      await this.factionRepo.decrementTerritoryCount(factionId, conn)
      await conn.commit()
    } catch (err) {
      try { await conn.rollback() } catch { /* ignore */ }
      throw err
    } finally {
      conn.release()
    }

    this.eventBus.emit('atc:faction:territory:released', {
      territoryId: territory.id,
      factionId,
    }).catch(() => undefined)
  }

  async listControlledTerritories(factionId: string): Promise<AtcTerritory[]> {
    return this.territoryRepo.listByFaction(factionId)
  }
}
