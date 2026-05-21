import type { TacticalDamageRepository, AtcTacticalDamage, CreateDamageParams } from './tactical-damage.repository.js'
import type { CombatAuditRepository } from './combat-audit.repository.js'
import type { CombatSimulationEventBus } from './combat-simulation.service.js'

export class TacticalDamageService {
  constructor(
    private damageRepo: TacticalDamageRepository,
    private auditRepo: CombatAuditRepository,
    private eventBus: CombatSimulationEventBus,
  ) {}

  async applyDamage(params: CreateDamageParams): Promise<AtcTacticalDamage> {
    const record = await this.damageRepo.create(params)
    this.eventBus.emit('atc:combat:damage:applied', { id: record.id, entityId: record.entityId, amount: record.damageAmount }).catch(() => undefined)
    return record
  }

  async processDamage(id: string): Promise<AtcTacticalDamage> {
    return this.damageRepo.markProcessed(id)
  }

  async listPendingBySession(sessionId: string): Promise<AtcTacticalDamage[]> {
    return this.damageRepo.listUnprocessedBySession(sessionId)
  }
}
