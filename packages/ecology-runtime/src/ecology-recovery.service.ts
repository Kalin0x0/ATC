import type { EcologyRuntimeRepository } from './ecology-runtime.repository.js'
import type { EnvironmentalEvolutionRepository } from './environmental-evolution.repository.js'
import type { ResourceRegenerationRepository } from './resource-regeneration.repository.js'
import type { EcologyAuditRepository } from './ecology-audit.repository.js'

export interface EcologyRuntimeEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export interface CleanupStaleResult {
  ecologies: number
  evolutions: number
  regenerations: number
}

export class EcologyRecoveryService {
  constructor(
    private readonly ecologyRepo: EcologyRuntimeRepository,
    private readonly evolutionRepo: EnvironmentalEvolutionRepository,
    private readonly regenerationRepo: ResourceRegenerationRepository,
    private readonly auditRepo: EcologyAuditRepository,
    private readonly eventBus: EcologyRuntimeEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<CleanupStaleResult> {
    const [ecologies, evolutions, regenerations] = await Promise.all([
      this.ecologyRepo.cleanupStale(thresholdMs),
      this.evolutionRepo.cleanupStale(thresholdMs),
      this.regenerationRepo.cleanupStale(thresholdMs),
    ])

    await this.auditRepo.append({
      eventType: 'cleanup_stale',
      auditData: { thresholdMs, ecologies, evolutions, regenerations },
    })

    this.eventBus.emit('atc:ecology:cleanup:completed', {
      thresholdMs,
      ecologies,
      evolutions,
      regenerations,
    }).catch(() => undefined)

    return { ecologies, evolutions, regenerations }
  }
}
