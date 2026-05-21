import type { AtcEventBus } from '@atc/events'
import type { FactionPool } from './pool.js'
import { FactionRepository, type CreateFactionParams, type AtcFaction } from './faction.repository.js'
import { FactionNotFoundError } from './errors.js'

export class FactionRuntimeService {
  private readonly factionRepo: FactionRepository

  constructor(
    private readonly pool: FactionPool,
    private readonly eventBus: AtcEventBus,
  ) {
    this.factionRepo = new FactionRepository(pool)
  }

  async createFaction(params: CreateFactionParams): Promise<AtcFaction> {
    const faction = await this.factionRepo.create(params)
    this.eventBus.emit('atc:faction:created', {
      factionId: faction.id,
      name: faction.name,
      tag: faction.tag,
      factionType: faction.factionType,
    }).catch(() => undefined)
    return faction
  }

  async disbandFaction(id: string): Promise<void> {
    const faction = await this.factionRepo.findById(id)
    if (!faction) throw new FactionNotFoundError(id)
    await this.factionRepo.updateStatus(id, 'disbanded')
    this.eventBus.emit('atc:faction:disbanded', { factionId: id }).catch(() => undefined)
  }

  async addMember(factionId: string, principalId: string, _rank: string): Promise<void> {
    const faction = await this.factionRepo.findById(factionId)
    if (!faction) throw new FactionNotFoundError(factionId)
    await this.factionRepo.incrementMemberCount(factionId)
    this.eventBus.emit('atc:faction:member:joined', { factionId, principalId }).catch(() => undefined)
  }

  async removeMember(factionId: string, principalId: string): Promise<void> {
    const faction = await this.factionRepo.findById(factionId)
    if (!faction) throw new FactionNotFoundError(factionId)
    await this.factionRepo.decrementMemberCount(factionId)
    this.eventBus.emit('atc:faction:member:left', { factionId, principalId }).catch(() => undefined)
  }
}
