import type { RuntimeSovereigntyRepository } from './runtime-sovereignty.repository.js'
import type { ClusterContinuityRepository } from './cluster-continuity.repository.js'
import type { AutonomousFinalizationRepository } from './autonomous-finalization.repository.js'
import type { RuntimeSuccessionRepository } from './runtime-succession.repository.js'
import type { SovereigntyCoordinationRepository } from './sovereignty-coordination.repository.js'
import type { SovereigntyAuditRepository } from './sovereignty-audit.repository.js'

export interface SovereigntyRuntimeEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export interface SovereigntyCleanupResult {
  sovereignties: number
  clusterNodes: number
  finalizations: number
  successions: number
  coordinations: number
}

export class SovereigntyRecoveryService {
  constructor(
    private sovereigntyRepo: RuntimeSovereigntyRepository,
    private clusterRepo: ClusterContinuityRepository,
    private finalizationRepo: AutonomousFinalizationRepository,
    private successionRepo: RuntimeSuccessionRepository,
    private coordinationRepo: SovereigntyCoordinationRepository,
    private auditRepo: SovereigntyAuditRepository,
    private eventBus: SovereigntyRuntimeEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<SovereigntyCleanupResult> {
    const [sovereignties, clusterNodes, finalizations, successions, coordinations] = await Promise.all([
      this.sovereigntyRepo.cleanupStale(thresholdMs),
      this.clusterRepo.cleanupStale(thresholdMs),
      this.finalizationRepo.cleanupStale(thresholdMs),
      this.successionRepo.cleanupStale(thresholdMs),
      this.coordinationRepo.cleanupStale(thresholdMs),
    ])

    await this.auditRepo.append({
      eventType: 'stale_cleanup',
      auditData: { sovereignties, clusterNodes, finalizations, successions, coordinations, thresholdMs },
    })

    this.eventBus.emit('atc:runtime-sovereignty:stale:cleaned', {
      sovereignties,
      clusterNodes,
      finalizations,
      successions,
      coordinations,
    }).catch(() => undefined)

    return { sovereignties, clusterNodes, finalizations, successions, coordinations }
  }
}
