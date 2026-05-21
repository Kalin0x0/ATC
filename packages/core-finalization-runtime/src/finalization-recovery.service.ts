import type { CoreFinalizationRepository } from './core-finalization.repository.js'
import type { RuntimeCompletionRepository } from './runtime-completion.repository.js'
import type { ProductionSealRepository } from './production-seal.repository.js'
import type { FinalizationCoordinationRepository } from './finalization-coordination.repository.js'
import type { DeterministicSealingRepository } from './deterministic-sealing.repository.js'
import type { CoreFinalizationAuditRepository } from './core-finalization-audit.repository.js'

export interface CoreFinalizationEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export interface CoreFinalizationCleanupResult {
  finalizations: number
  completions: number
  seals: number
  coordinations: number
  sealings: number
}

export class FinalizationRecoveryService {
  constructor(
    private finalizationRepo: CoreFinalizationRepository,
    private completionRepo: RuntimeCompletionRepository,
    private sealRepo: ProductionSealRepository,
    private coordinationRepo: FinalizationCoordinationRepository,
    private sealingRepo: DeterministicSealingRepository,
    private auditRepo: CoreFinalizationAuditRepository,
    private eventBus: CoreFinalizationEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<CoreFinalizationCleanupResult> {
    const [finalizations, completions, seals, coordinations, sealings] = await Promise.all([
      this.finalizationRepo.cleanupStale(thresholdMs),
      this.completionRepo.cleanupStale(thresholdMs),
      this.sealRepo.cleanupStale(thresholdMs),
      this.coordinationRepo.cleanupStale(thresholdMs),
      this.sealingRepo.cleanupStale(thresholdMs),
    ])

    await this.auditRepo.append({
      eventType: 'stale_cleanup',
      auditData: { finalizations, completions, seals, coordinations, sealings, thresholdMs },
    })

    this.eventBus.emit('atc:core-finalization-runtime:stale:cleaned', {
      finalizations,
      completions,
      seals,
      coordinations,
      sealings,
    }).catch(() => undefined)

    return { finalizations, completions, seals, coordinations, sealings }
  }
}
