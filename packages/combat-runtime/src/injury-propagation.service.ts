import type { AtcCombatInjury, AtcCombatBodyRegion, AtcInjurySeverity } from '@atc/shared-types'
import { ATC_COMBAT_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { InjuryRepository } from './injury.repository.js'
import { InjuryNotFoundError } from './errors.js'

export interface InjuryPropagationDeps {
  injuryRepo: InjuryRepository
  eventBus: AtcEventBus | undefined
}

export class InjuryPropagationService {
  private readonly injuryRepo: InjuryRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: InjuryPropagationDeps) {
    this.injuryRepo = deps.injuryRepo
    this.eventBus   = deps.eventBus
  }

  async applyInjury(params: {
    principalId: string
    bodyRegion: AtcCombatBodyRegion
    severity: AtcInjurySeverity
    sourceDamageEventId?: string | null | undefined
  }): Promise<AtcCombatInjury> {
    const injury = await this.injuryRepo.record({
      principalId:          params.principalId,
      bodyRegion:           params.bodyRegion,
      severity:             params.severity,
      sourceDamageEventId:  params.sourceDamageEventId,
    })

    this.eventBus?.emit(ATC_COMBAT_EVENTS.INJURY_APPLIED, {
      injuryId:            injury.id,
      principalId:         injury.principalId,
      bodyRegion:          injury.bodyRegion,
      severity:            injury.severity,
      sourceDamageEventId: injury.sourceDamageEventId,
    }).catch(() => undefined)

    return injury
  }

  async resolveInjury(injuryId: string): Promise<AtcCombatInjury> {
    const injury = await this.injuryRepo.findById(injuryId)
    if (!injury) throw new InjuryNotFoundError(injuryId)

    await this.injuryRepo.resolve(injuryId)

    const resolved = await this.injuryRepo.findById(injuryId)
    if (!resolved) throw new InjuryNotFoundError(injuryId)

    this.eventBus?.emit(ATC_COMBAT_EVENTS.INJURY_RESOLVED, {
      injuryId:    resolved.id,
      principalId: resolved.principalId,
      bodyRegion:  resolved.bodyRegion,
      resolvedAt:  resolved.resolvedAt,
    }).catch(() => undefined)

    return resolved
  }

  async resolveAllInjuries(principalId: string): Promise<void> {
    await this.injuryRepo.resolveAll(principalId)
  }

  async getActiveInjuries(principalId: string): Promise<AtcCombatInjury[]> {
    return this.injuryRepo.listActive(principalId)
  }
}
