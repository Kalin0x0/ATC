import type { RuntimeEvolutionRepository, AtcRuntimeEvolution, AtcEvolutionRuntimeType } from './runtime-evolution.repository.js'
import type { EvolutionAuditRepository } from './evolution-audit.repository.js'
import type { EvolutionRuntimeEventBus } from './evolution-recovery.service.js'

export interface StartEvolutionRuntimeServiceParams {
  evolutionType: AtcEvolutionRuntimeType
  ownerServerId: string
  evolutionNonce: string
  evolutionData?: Record<string, unknown> | undefined
}

export class EvolutionRuntimeService {
  constructor(
    private readonly evolutionRepo: RuntimeEvolutionRepository,
    private readonly auditRepo: EvolutionAuditRepository,
    private readonly eventBus: EvolutionRuntimeEventBus,
  ) {}

  async startEvolution(params: StartEvolutionRuntimeServiceParams): Promise<AtcRuntimeEvolution> {
    const evolution = await this.evolutionRepo.create(params)
    await this.auditRepo.append({
      eventType: 'evolution_started',
      evolutionId: evolution.evolutionId,
      ownerServerId: evolution.ownerServerId,
      auditData: { evolutionType: evolution.evolutionType, status: evolution.status },
    })
    this.eventBus.emit('atc:evolution:runtime:started', { id: evolution.id, evolutionId: evolution.evolutionId, evolutionType: evolution.evolutionType }).catch(() => undefined)
    return evolution
  }

  async activateEvolution(id: string): Promise<AtcRuntimeEvolution> {
    const evolution = await this.evolutionRepo.updateStatus(id, 'active')
    this.eventBus.emit('atc:evolution:runtime:activated', { id: evolution.id, evolutionId: evolution.evolutionId }).catch(() => undefined)
    return evolution
  }

  async completeEvolution(id: string): Promise<AtcRuntimeEvolution> {
    const evolution = await this.evolutionRepo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({
      eventType: 'evolution_completed',
      evolutionId: evolution.evolutionId,
      ownerServerId: evolution.ownerServerId,
      auditData: { completedAt: evolution.completedAt },
    })
    this.eventBus.emit('atc:evolution:runtime:completed', { id: evolution.id, evolutionId: evolution.evolutionId }).catch(() => undefined)
    return evolution
  }

  async failEvolution(id: string): Promise<AtcRuntimeEvolution> {
    return this.evolutionRepo.updateStatus(id, 'failed')
  }

  async rollbackEvolution(id: string): Promise<AtcRuntimeEvolution> {
    return this.evolutionRepo.updateStatus(id, 'rolled_back')
  }

  async getEvolution(id: string): Promise<AtcRuntimeEvolution | null> {
    return this.evolutionRepo.findById(id)
  }
}
