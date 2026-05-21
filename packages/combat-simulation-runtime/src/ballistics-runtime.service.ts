import type { BallisticsRuntimeRepository, AtcBallisticRecord, CreateBallisticParams } from './ballistics-runtime.repository.js'
import type { CombatAuditRepository } from './combat-audit.repository.js'
import type { CombatSimulationEventBus } from './combat-simulation.service.js'

export class BallisticsRuntimeService {
  constructor(
    private ballisticsRepo: BallisticsRuntimeRepository,
    private auditRepo: CombatAuditRepository,
    private eventBus: CombatSimulationEventBus,
  ) {}

  async recordImpact(params: CreateBallisticParams): Promise<AtcBallisticRecord> {
    const record = await this.ballisticsRepo.create(params)
    this.eventBus.emit('atc:combat:ballistic:impact', { id: record.id, sessionId: record.sessionId }).catch(() => undefined)
    return record
  }

  async resolveImpact(id: string): Promise<AtcBallisticRecord> {
    return this.ballisticsRepo.markResolved(id)
  }

  async listPendingBySession(sessionId: string): Promise<AtcBallisticRecord[]> {
    return this.ballisticsRepo.listUnresolvedBySession(sessionId)
  }
}
