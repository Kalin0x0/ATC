import type { AutonomousEvolutionRepository, AtcAutonomousEvolution, AtcAutonomousEvolutionType } from './autonomous-evolution.repository.js'
import type { EvolutionAuditRepository } from './evolution-audit.repository.js'
import type { EvolutionRuntimeEventBus } from './evolution-recovery.service.js'

export interface TriggerAutonomousEvolutionServiceParams {
  autonomousType: AtcAutonomousEvolutionType
  ownerServerId: string
  autonomousNonce: string
  triggerData?: Record<string, unknown> | undefined
}

export class AutonomousEvolutionService {
  constructor(
    private readonly autonomousRepo: AutonomousEvolutionRepository,
    private readonly auditRepo: EvolutionAuditRepository,
    private readonly eventBus: EvolutionRuntimeEventBus,
  ) {}

  async triggerEvolution(params: TriggerAutonomousEvolutionServiceParams): Promise<AtcAutonomousEvolution> {
    const evolution = await this.autonomousRepo.create(params)
    await this.auditRepo.append({
      eventType: 'autonomous_evolution_triggered',
      evolutionId: evolution.autonomousId,
      ownerServerId: evolution.ownerServerId,
      auditData: { autonomousType: evolution.autonomousType, status: evolution.status },
    })
    this.eventBus.emit('atc:evolution:autonomous:triggered', { id: evolution.id, autonomousId: evolution.autonomousId, autonomousType: evolution.autonomousType }).catch(() => undefined)
    return evolution
  }

  async applyEvolution(id: string, outcomeData?: Record<string, unknown> | undefined): Promise<AtcAutonomousEvolution> {
    const evolution = await this.autonomousRepo.updateStatus(id, 'applied', new Date(), outcomeData)
    await this.auditRepo.append({
      eventType: 'autonomous_evolution_applied',
      evolutionId: evolution.autonomousId,
      ownerServerId: evolution.ownerServerId,
      auditData: { appliedAt: evolution.appliedAt, outcomeData: evolution.outcomeData },
    })
    this.eventBus.emit('atc:evolution:autonomous:applied', { id: evolution.id, autonomousId: evolution.autonomousId }).catch(() => undefined)
    return evolution
  }

  async revertEvolution(id: string): Promise<AtcAutonomousEvolution> {
    return this.autonomousRepo.updateStatus(id, 'reverted')
  }

  async failEvolution(id: string): Promise<AtcAutonomousEvolution> {
    return this.autonomousRepo.updateStatus(id, 'failed')
  }

  async getEvolution(id: string): Promise<AtcAutonomousEvolution | null> {
    return this.autonomousRepo.findById(id)
  }
}
