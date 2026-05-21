import type { InterclusterRouteRepository, AtcInterclusterRoute, CreateRouteParams } from './intercluster-route.repository.js'
import type { FederationAuditRepository } from './federation-audit.repository.js'
import type { FederationRuntimeEventBus } from './federation-recovery.service.js'

export class InterclusterRoutingService {
  constructor(
    private routeRepo: InterclusterRouteRepository,
    private auditRepo: FederationAuditRepository,
    private eventBus: FederationRuntimeEventBus,
  ) {}

  async createRoute(params: CreateRouteParams): Promise<AtcInterclusterRoute> {
    const route = await this.routeRepo.create(params)
    await this.auditRepo.append({ eventType: 'route_created', auditData: { routeId: route.routeId } })
    this.eventBus.emit('atc:federation:route:created', { routeId: route.routeId }).catch(() => undefined)
    return route
  }

  async completeRoute(id: string): Promise<AtcInterclusterRoute> {
    const route = await this.routeRepo.updateStatus(id, 'inactive')
    this.eventBus.emit('atc:federation:route:completed', { routeId: route.routeId }).catch(() => undefined)
    return route
  }

  async failRoute(id: string): Promise<AtcInterclusterRoute> {
    const route = await this.routeRepo.updateStatus(id, 'failed')
    this.eventBus.emit('atc:federation:route:failed', { routeId: route.routeId }).catch(() => undefined)
    return route
  }

  async getRoute(id: string): Promise<AtcInterclusterRoute | null> {
    return this.routeRepo.findById(id)
  }
}
