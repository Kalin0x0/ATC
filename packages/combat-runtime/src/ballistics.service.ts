import type { AtcBallisticsRecord } from '@atc/shared-types'
import type { BallisticsRepository } from './ballistics.repository.js'

export interface BallisticsDeps {
  ballisticsRepo: BallisticsRepository
}

export class BallisticsService {
  private readonly ballisticsRepo: BallisticsRepository

  constructor(deps: BallisticsDeps) {
    this.ballisticsRepo = deps.ballisticsRepo
  }

  async recordBallistics(params: {
    damageEventId: string
    velocity?: number | undefined
    distance?: number | undefined
    impactAngle?: number | undefined
    penetrationData?: string | undefined
  }): Promise<AtcBallisticsRecord> {
    return this.ballisticsRepo.record({
      damageEventId:   params.damageEventId,
      velocity:        params.velocity,
      distance:        params.distance,
      impactAngle:     params.impactAngle,
      penetrationData: params.penetrationData,
    })
  }

  async getByDamageEvent(damageEventId: string): Promise<AtcBallisticsRecord | null> {
    return this.ballisticsRepo.findByDamageEvent(damageEventId)
  }
}
