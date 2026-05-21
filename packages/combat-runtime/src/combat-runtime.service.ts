import type { AtcCombatSession } from '@atc/shared-types'
import { ATC_COMBAT_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { CombatSessionRepository } from './combat-session.repository.js'
import type { CombatPool } from './pool.js'
import { CombatSessionNotFoundError } from './errors.js'

export interface CombatRuntimeDeps {
  sessionRepo: CombatSessionRepository
  pool: CombatPool
  eventBus: AtcEventBus | undefined
}

export class CombatRuntimeService {
  private readonly sessionRepo: CombatSessionRepository
  private readonly pool: CombatPool
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: CombatRuntimeDeps) {
    this.sessionRepo = deps.sessionRepo
    this.pool        = deps.pool
    this.eventBus    = deps.eventBus
  }

  async startSession(initiatorPrincipalId: string): Promise<AtcCombatSession> {
    const session = await this.sessionRepo.create(initiatorPrincipalId)

    this.eventBus?.emit(ATC_COMBAT_EVENTS.COMBAT_STARTED, {
      sessionId: session.id,
      initiatorPrincipalId,
    }).catch(() => undefined)

    return session
  }

  async endSession(sessionId: string, outcome?: string | undefined): Promise<AtcCombatSession> {
    await this.sessionRepo.end(sessionId, outcome)

    const session = await this.sessionRepo.findById(sessionId)
    if (!session) throw new CombatSessionNotFoundError(sessionId)

    this.eventBus?.emit(ATC_COMBAT_EVENTS.COMBAT_ENDED, {
      sessionId,
      outcome: outcome ?? null,
    }).catch(() => undefined)

    return session
  }

  async getSession(sessionId: string): Promise<AtcCombatSession | null> {
    return this.sessionRepo.findById(sessionId)
  }

  async cleanStaleSessions(olderThanMinutes: number): Promise<void> {
    await this.sessionRepo.cleanStale(olderThanMinutes)
  }
}
