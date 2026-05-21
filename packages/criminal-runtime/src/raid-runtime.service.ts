import type { AtcRaid, AtcRaidOutcome } from '@atc/shared-types'
import { ATC_CRIMINAL_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { RaidRepository } from './raid.repository.js'
import type { CriminalPool } from './pool.js'
export interface RaidRuntimeDeps {
  raidRepo: RaidRepository
  pool: CriminalPool
  eventBus: AtcEventBus | undefined
}

export interface StageRaidParams {
  propertyId: string
  initiatingAgencyId?: string | null | undefined
  leadPrincipalId: string
  participants: string[]
  notes?: string | undefined
}

export class RaidRuntimeService {
  private readonly raidRepo: RaidRepository
  private readonly pool: CriminalPool
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: RaidRuntimeDeps) {
    this.raidRepo  = deps.raidRepo
    this.pool      = deps.pool
    this.eventBus  = deps.eventBus
  }

  async stageRaid(params: StageRaidParams): Promise<AtcRaid> {
    return this.raidRepo.create({
      propertyId: params.propertyId,
      initiatingAgencyId: params.initiatingAgencyId,
      leadPrincipalId: params.leadPrincipalId,
      participants: params.participants,
      notes: params.notes,
    })
  }

  async startRaid(raidId: string): Promise<AtcRaid> {
    const raid = await this.raidRepo.transition(raidId, 'active')

    this.eventBus?.emit(ATC_CRIMINAL_EVENTS.RAID_STARTED, {
      raidId,
      propertyId: raid.propertyId,
      leadPrincipalId: raid.leadPrincipalId,
      participants: raid.participants,
    }).catch(() => undefined)

    return raid
  }

  async completeRaid(raidId: string, outcome: AtcRaidOutcome, notes?: string): Promise<AtcRaid> {
    const raid = await this.raidRepo.transition(raidId, 'completed', { outcome, notes })

    this.eventBus?.emit(ATC_CRIMINAL_EVENTS.RAID_COMPLETED, {
      raidId,
      propertyId: raid.propertyId,
      outcome,
      notes: notes ?? null,
    }).catch(() => undefined)

    return raid
  }

  async abortRaid(raidId: string, notes?: string): Promise<AtcRaid> {
    return this.raidRepo.transition(raidId, 'aborted', { notes })
  }

  async getRaid(id: string): Promise<AtcRaid | null> {
    return this.raidRepo.findById(id)
  }

  async listByProperty(propertyId: string): Promise<AtcRaid[]> {
    return this.raidRepo.listByProperty(propertyId)
  }

  async listActiveByLead(principalId: string): Promise<AtcRaid[]> {
    return this.raidRepo.listActiveByLead(principalId)
  }
}
