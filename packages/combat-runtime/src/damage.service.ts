import type { AtcDamageEvent, AtcCombatBodyRegion } from '@atc/shared-types'
import { ATC_COMBAT_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { DamageRepository } from './damage.repository.js'
import type { BallisticsRepository } from './ballistics.repository.js'
import type { InjuryRepository } from './injury.repository.js'
import type { CombatSessionRepository } from './combat-session.repository.js'
import type { CombatPool } from './pool.js'

export interface DamageDeps {
  damageRepo: DamageRepository
  ballisticsRepo: BallisticsRepository
  injuryRepo: InjuryRepository
  sessionRepo: CombatSessionRepository
  pool: CombatPool
  eventBus: AtcEventBus | undefined
}

export interface ApplyDamageParams {
  sessionId?: string | null | undefined
  attackerPrincipalId: string
  victimPrincipalId: string
  weaponId?: string | null | undefined
  weaponModel: string
  hitBone: AtcCombatBodyRegion
  damageAmount: number
  mitigatedAmount: number
  replayNonce: string
  hitX?: number | null | undefined
  hitY?: number | null | undefined
  hitZ?: number | null | undefined
  ballistics?: {
    velocity?: number | undefined
    distance?: number | undefined
    impactAngle?: number | undefined
    penetrationData?: string | undefined
  } | undefined
}

export class DamageService {
  private readonly damageRepo: DamageRepository
  private readonly ballisticsRepo: BallisticsRepository
  private readonly injuryRepo: InjuryRepository
  private readonly sessionRepo: CombatSessionRepository
  private readonly pool: CombatPool
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: DamageDeps) {
    this.damageRepo      = deps.damageRepo
    this.ballisticsRepo  = deps.ballisticsRepo
    this.injuryRepo      = deps.injuryRepo
    this.sessionRepo     = deps.sessionRepo
    this.pool            = deps.pool
    this.eventBus        = deps.eventBus
  }

  async applyDamage(params: ApplyDamageParams): Promise<AtcDamageEvent> {
    const netDamage = Math.max(0, params.damageAmount - params.mitigatedAmount)

    // Record damage event — throws DuplicateDamageError on repeated nonce
    const damageEvent = await this.damageRepo.record({
      sessionId:            params.sessionId ?? null,
      attackerPrincipalId:  params.attackerPrincipalId,
      victimPrincipalId:    params.victimPrincipalId,
      weaponId:             params.weaponId ?? null,
      weaponModel:          params.weaponModel,
      hitBone:              params.hitBone,
      damageAmount:         params.damageAmount,
      mitigatedAmount:      params.mitigatedAmount,
      netDamage,
      hitX:                 params.hitX ?? null,
      hitY:                 params.hitY ?? null,
      hitZ:                 params.hitZ ?? null,
      replayNonce:          params.replayNonce,
    })

    // Record ballistics if provided (fire-and-forget on failure)
    if (params.ballistics) {
      await this.ballisticsRepo.record({
        damageEventId:  damageEvent.id,
        velocity:       params.ballistics.velocity,
        distance:       params.ballistics.distance,
        impactAngle:    params.ballistics.impactAngle,
        penetrationData: params.ballistics.penetrationData,
      }).catch(() => undefined)
    }

    this.eventBus?.emit(ATC_COMBAT_EVENTS.DAMAGE_APPLIED, {
      damageEventId:       damageEvent.id,
      sessionId:           damageEvent.sessionId,
      attackerPrincipalId: damageEvent.attackerPrincipalId,
      victimPrincipalId:   damageEvent.victimPrincipalId,
      netDamage,
      hitBone:             damageEvent.hitBone,
    }).catch(() => undefined)

    return damageEvent
  }

  async getDamageEvent(id: string): Promise<AtcDamageEvent | null> {
    return this.damageRepo.findById(id)
  }

  async getSessionDamage(sessionId: string): Promise<AtcDamageEvent[]> {
    return this.damageRepo.listBySession(sessionId)
  }
}
