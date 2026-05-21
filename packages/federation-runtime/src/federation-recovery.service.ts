import type { FederationNodeRepository } from './federation-node.repository.js'
import type { InterclusterRouteRepository } from './intercluster-route.repository.js'
import type { RegionalConsistencyRepository } from './regional-consistency.repository.js'
import type { FederationAuditRepository } from './federation-audit.repository.js'

export interface FederationRuntimeEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export class FederationRecoveryService {
  constructor(
    private nodeRepo: FederationNodeRepository,
    private routeRepo: InterclusterRouteRepository,
    private checkRepo: RegionalConsistencyRepository,
    private auditRepo: FederationAuditRepository,
    private eventBus: FederationRuntimeEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<{ nodes: number; routes: number; checks: number }> {
    const [nodes, routes, checks] = await Promise.all([
      this.nodeRepo.cleanupStale(thresholdMs),
      this.routeRepo.cleanupStale(thresholdMs),
      this.checkRepo.cleanupStale(thresholdMs),
    ])
    await this.auditRepo.append({ eventType: 'cleanup_completed', auditData: { nodes, routes, checks } })
    this.eventBus.emit('atc:federation:cleanup:completed', { nodes, routes, checks }).catch(() => undefined)
    return { nodes, routes, checks }
  }
}
