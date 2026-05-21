import type { AtcEventBus } from '@atc/events'
import type { FactionPool } from './pool.js'
import { FactionConflictRepository, type AtcFactionConflict, type AtcConflictType, type AtcConflictOutcome, type CreateConflictParams } from './faction-conflict.repository.js'
import { TerritoryRepository } from './territory.repository.js'
import { FactionRepository } from './faction.repository.js'
import { ConflictNotFoundError, TerritoryNotFoundError } from './errors.js'

export interface StartConflictParams {
  territoryId: string
  attackerFactionId: string
  defenderFactionId?: string | null | undefined
  initiatingPrincipalId: string
  conflictType: AtcConflictType
  conflictNonce: string
  participants?: string[]
  notes?: string | null | undefined
}

export class ConflictRuntimeService {
  private readonly conflictRepo: FactionConflictRepository
  private readonly territoryRepo: TerritoryRepository
  private readonly factionRepo: FactionRepository

  constructor(
    private readonly pool: FactionPool,
    private readonly eventBus: AtcEventBus,
  ) {
    this.conflictRepo = new FactionConflictRepository(pool)
    this.territoryRepo = new TerritoryRepository(pool)
    this.factionRepo = new FactionRepository(pool)
  }

  async startConflict(params: StartConflictParams): Promise<AtcFactionConflict> {
    const territory = await this.territoryRepo.findByTerritoryId(params.territoryId)
    if (!territory) throw new TerritoryNotFoundError(params.territoryId)

    const createParams: CreateConflictParams = {
      territoryId: territory.id,
      attackerFactionId: params.attackerFactionId,
      ...(params.defenderFactionId !== undefined ? { defenderFactionId: params.defenderFactionId } : {}),
      initiatingPrincipalId: params.initiatingPrincipalId,
      conflictType: params.conflictType,
      conflictNonce: params.conflictNonce,
      ...(params.participants !== undefined ? { participants: params.participants } : {}),
      ...(params.notes !== undefined ? { notes: params.notes } : {}),
    }

    const conflict = await this.conflictRepo.create(createParams)
    await this.territoryRepo.setContested(territory.id, true)

    this.eventBus.emit('atc:faction:conflict:started', {
      conflictId: conflict.id,
      territoryId: territory.id,
      attackerFactionId: params.attackerFactionId,
    }).catch(() => undefined)

    return conflict
  }

  async resolveConflict(conflictId: string, outcome: AtcConflictOutcome, notes?: string | null | undefined): Promise<AtcFactionConflict> {
    const conflict = await this.conflictRepo.findById(conflictId)
    if (!conflict) throw new ConflictNotFoundError(conflictId)

    const resolved = await this.conflictRepo.transition(conflictId, 'resolved', outcome, { notes })
    await this.territoryRepo.setContested(conflict.territoryId, false)

    if (outcome === 'attacker_won') {
      await this.territoryRepo.setController(conflict.territoryId, conflict.attackerFactionId)
    }

    this.eventBus.emit('atc:faction:conflict:resolved', {
      conflictId,
      outcome,
      territoryId: conflict.territoryId,
    }).catch(() => undefined)

    return resolved
  }

  async abortConflict(conflictId: string, notes?: string | null | undefined): Promise<AtcFactionConflict> {
    const conflict = await this.conflictRepo.findById(conflictId)
    if (!conflict) throw new ConflictNotFoundError(conflictId)

    const aborted = await this.conflictRepo.transition(conflictId, 'aborted', 'aborted', { notes })
    await this.territoryRepo.setContested(conflict.territoryId, false)

    return aborted
  }

  async cleanStaleConflicts(olderThanMinutes: number): Promise<number> {
    const count = await this.conflictRepo.cleanStale(olderThanMinutes)
    return count
  }
}
