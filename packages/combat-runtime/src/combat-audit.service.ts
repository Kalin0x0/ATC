import type { AtcCombatSession, AtcDamageEvent } from '@atc/shared-types'
import type { DamageRepository } from './damage.repository.js'
import type { CombatSessionRepository } from './combat-session.repository.js'

export interface CombatAuditDeps {
  damageRepo: DamageRepository
  sessionRepo: CombatSessionRepository
}

export class CombatAuditService {
  private readonly damageRepo: DamageRepository
  private readonly sessionRepo: CombatSessionRepository

  constructor(deps: CombatAuditDeps) {
    this.damageRepo  = deps.damageRepo
    this.sessionRepo = deps.sessionRepo
  }

  async getSessionAudit(
    sessionId: string,
  ): Promise<{ session: AtcCombatSession | null; damages: AtcDamageEvent[] }> {
    const [session, damages] = await Promise.all([
      this.sessionRepo.findById(sessionId),
      this.damageRepo.listBySession(sessionId),
    ])
    return { session, damages }
  }

  async getVictimHistory(principalId: string, limit?: number | undefined): Promise<AtcDamageEvent[]> {
    return this.damageRepo.listByVictim(principalId, limit)
  }

  async getAttackerHistory(principalId: string, limit?: number | undefined): Promise<AtcDamageEvent[]> {
    return this.damageRepo.listByAttacker(principalId, limit)
  }
}
