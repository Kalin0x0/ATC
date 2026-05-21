import type { CombatRuntimeRepository, AtcCombatSession, CreateCombatSessionParams } from './combat-runtime.repository.js'
import type { CombatAuditRepository } from './combat-audit.repository.js'

export interface CombatSimulationEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export class CombatSimulationService {
  constructor(
    private combatRepo: CombatRuntimeRepository,
    private auditRepo: CombatAuditRepository,
    private eventBus: CombatSimulationEventBus,
  ) {}

  async startCombat(params: CreateCombatSessionParams): Promise<AtcCombatSession> {
    const session = await this.combatRepo.create(params)
    await this.auditRepo.append({ sessionId: session.sessionId, eventType: 'combat_started', entityId: session.entityId })
    this.eventBus.emit('atc:combat:session:started', { sessionId: session.sessionId }).catch(() => undefined)
    return session
  }

  async endCombat(id: string): Promise<AtcCombatSession> {
    const session = await this.combatRepo.updateStatus(id, 'ended', new Date())
    await this.auditRepo.append({ sessionId: session.sessionId, eventType: 'combat_ended', entityId: session.entityId })
    this.eventBus.emit('atc:combat:session:ended', { sessionId: session.sessionId }).catch(() => undefined)
    return session
  }

  async getSession(id: string): Promise<AtcCombatSession | null> {
    return this.combatRepo.findById(id)
  }

  async listActiveSessions(ownerServerId?: string): Promise<AtcCombatSession[]> {
    return this.combatRepo.listActive(ownerServerId)
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    return this.combatRepo.cleanupStale(thresholdMs)
  }
}
