import type { AtcEventBus } from '@atc/events'
import type { SupplyRouteRepository } from './supply-route.repository.js'
import type { AtcRouteType, AtcSupplyRoute } from './supply-route.repository.js'

export class SupplyRouteService {
  constructor(
    private readonly routeRepo: SupplyRouteRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async registerRoute(params: {
    routeId: string
    routeName: string
    originNodeId: string
    destinationNodeId: string
    routeType: AtcRouteType
    distanceKm: number
    estimatedDurationMinutes: number
  }): Promise<AtcSupplyRoute> {
    const route = await this.routeRepo.upsert(params)
    this.eventBus.emit('atc:logistics:route:registered', { routeId: route.routeId }).catch(() => undefined)
    return route
  }

  async getRoute(routeId: string): Promise<AtcSupplyRoute | null> {
    return this.routeRepo.findByRouteId(routeId)
  }

  async listActiveRoutes(): Promise<AtcSupplyRoute[]> {
    return this.routeRepo.listActive()
  }
}
