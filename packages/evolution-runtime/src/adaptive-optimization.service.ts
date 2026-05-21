import type { AdaptiveOptimizationRepository, AtcAdaptiveOptimization, AtcOptimizationType } from './adaptive-optimization.repository.js'
import type { EvolutionAuditRepository } from './evolution-audit.repository.js'
import type { EvolutionRuntimeEventBus } from './evolution-recovery.service.js'

export interface StartOptimizationServiceParams {
  optimizationType: AtcOptimizationType
  ownerServerId: string
  targetNode: string
  optimizationNonce: string
  optimizationData?: Record<string, unknown> | undefined
}

export class AdaptiveOptimizationService {
  constructor(
    private readonly optimizationRepo: AdaptiveOptimizationRepository,
    private readonly auditRepo: EvolutionAuditRepository,
    private readonly eventBus: EvolutionRuntimeEventBus,
  ) {}

  async startOptimization(params: StartOptimizationServiceParams): Promise<AtcAdaptiveOptimization> {
    const optimization = await this.optimizationRepo.create(params)
    await this.auditRepo.append({
      eventType: 'optimization_started',
      ownerServerId: optimization.ownerServerId,
      auditData: { optimizationId: optimization.optimizationId, optimizationType: optimization.optimizationType, targetNode: optimization.targetNode },
    })
    this.eventBus.emit('atc:evolution:optimization:started', { id: optimization.id, optimizationId: optimization.optimizationId, targetNode: optimization.targetNode }).catch(() => undefined)
    return optimization
  }

  async completeOptimization(id: string): Promise<AtcAdaptiveOptimization> {
    const optimization = await this.optimizationRepo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({
      eventType: 'optimization_completed',
      ownerServerId: optimization.ownerServerId,
      auditData: { optimizationId: optimization.optimizationId, completedAt: optimization.completedAt },
    })
    this.eventBus.emit('atc:evolution:optimization:completed', { id: optimization.id, optimizationId: optimization.optimizationId }).catch(() => undefined)
    return optimization
  }

  async failOptimization(id: string): Promise<AtcAdaptiveOptimization> {
    return this.optimizationRepo.updateStatus(id, 'failed')
  }

  async getOptimization(id: string): Promise<AtcAdaptiveOptimization | null> {
    return this.optimizationRepo.findById(id)
  }
}
