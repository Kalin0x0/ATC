import type { CombatRuntimeRepository } from './combat-runtime.repository.js'
import type { BallisticsRuntimeRepository } from './ballistics-runtime.repository.js'
import type { TacticalDamageRepository } from './tactical-damage.repository.js'
import type { SuppressionRuntimeRepository } from './suppression-runtime.repository.js'
import type { CombatAuditRepository } from './combat-audit.repository.js'
import type { CombatSimulationEventBus } from './combat-simulation.service.js'

export class CombatRecoveryService {
  constructor(
    private combatRepo: CombatRuntimeRepository,
    private ballisticsRepo: BallisticsRuntimeRepository,
    private damageRepo: TacticalDamageRepository,
    private suppressionRepo: SuppressionRuntimeRepository,
    private auditRepo: CombatAuditRepository,
    private eventBus: CombatSimulationEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<{ sessions: number; suppression: number }> {
    const sessions = await this.combatRepo.cleanupStale(thresholdMs)
    const suppression = await this.suppressionRepo.cleanupExpired()
    return { sessions, suppression }
  }

  async recoverEntity(entityId: string): Promise<{ recovered: number }> {
    const active = await this.combatRepo.listActive()
    const entitySessions = active.filter(s => s.entityId === entityId)
    let recovered = 0
    for (const session of entitySessions) {
      await this.combatRepo.updateStatus(session.id, 'abandoned')
      recovered++
    }
    this.eventBus.emit('atc:combat:entity:recovered', { entityId, recovered }).catch(() => undefined)
    return { recovered }
  }
}
