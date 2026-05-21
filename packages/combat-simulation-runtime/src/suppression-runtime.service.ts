import type { SuppressionRuntimeRepository, AtcSuppressionRuntime, UpsertSuppressionParams } from './suppression-runtime.repository.js'
import type { CombatAuditRepository } from './combat-audit.repository.js'
import type { CombatSimulationEventBus } from './combat-simulation.service.js'

export class SuppressionRuntimeService {
  constructor(
    private suppressionRepo: SuppressionRuntimeRepository,
    private auditRepo: CombatAuditRepository,
    private eventBus: CombatSimulationEventBus,
  ) {}

  async applySuppression(params: UpsertSuppressionParams): Promise<AtcSuppressionRuntime> {
    const record = await this.suppressionRepo.upsert(params)
    this.eventBus.emit('atc:combat:suppression:applied', { entityId: record.entityId, level: record.suppressionLevel }).catch(() => undefined)
    return record
  }

  async getSuppression(entityId: string): Promise<AtcSuppressionRuntime | null> {
    return this.suppressionRepo.findByEntityId(entityId)
  }

  async clearSuppression(entityId: string): Promise<void> {
    await this.suppressionRepo.deactivate(entityId)
    this.eventBus.emit('atc:combat:suppression:cleared', { entityId }).catch(() => undefined)
  }

  async cleanupExpired(): Promise<number> {
    return this.suppressionRepo.cleanupExpired()
  }
}
