import type { RuntimeEvolutionRepository } from './runtime-evolution.repository.js'
import type { AdaptiveOptimizationRepository } from './adaptive-optimization.repository.js'
import type { RuntimeTuningRepository } from './runtime-tuning.repository.js'
import type { AutonomousEvolutionRepository } from './autonomous-evolution.repository.js'
import type { EvolutionAuditRepository } from './evolution-audit.repository.js'

export interface EvolutionRuntimeEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export interface EvolutionCleanupResult {
  evolutions: number
  optimizations: number
  tunings: number
  autonomousEvolutions: number
}

export class EvolutionRecoveryService {
  constructor(
    private readonly evolutionRepo: RuntimeEvolutionRepository,
    private readonly optimizationRepo: AdaptiveOptimizationRepository,
    private readonly tuningRepo: RuntimeTuningRepository,
    private readonly autonomousRepo: AutonomousEvolutionRepository,
    private readonly auditRepo: EvolutionAuditRepository,
    private readonly eventBus: EvolutionRuntimeEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<EvolutionCleanupResult> {
    const [evolutions, optimizations, tunings, autonomousEvolutions] = await Promise.all([
      this.evolutionRepo.cleanupStale(thresholdMs),
      this.optimizationRepo.cleanupStale(thresholdMs),
      this.tuningRepo.cleanupStale(thresholdMs),
      this.autonomousRepo.cleanupStale(thresholdMs),
    ])

    await this.auditRepo.append({
      eventType: 'cleanup_completed',
      auditData: { evolutions, optimizations, tunings, autonomousEvolutions },
    })
    this.eventBus.emit('atc:evolution:cleanup:completed', { evolutions, optimizations, tunings, autonomousEvolutions }).catch(() => undefined)

    return { evolutions, optimizations, tunings, autonomousEvolutions }
  }
}
