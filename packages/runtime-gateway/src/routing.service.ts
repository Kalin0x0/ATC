import type { GatewayRoutingRepository, AtcGatewayRouting, SyncRoutingParams } from './gateway-routing.repository.js'
import type { GatewayAuditRepository } from './gateway-audit.repository.js'
import type { RuntimeGatewayEventBus } from './runtime-gateway.service.js'

export class DistributedApiRoutingService {
  constructor(
    private readonly routingRepo: GatewayRoutingRepository,
    private readonly audit: GatewayAuditRepository,
    private readonly bus: RuntimeGatewayEventBus
  ) {}

  async configureRouting(params: SyncRoutingParams): Promise<AtcGatewayRouting> {
    const record = await this.routingRepo.upsert(params)
    await this.audit.append(record.id, 'routing.configured', { routingId: record.routingId })
    this.bus.emit('gateway_route_established', { routingId: record.routingId }).catch(() => undefined)
    return record
  }

  async activateRouting(routingId: string): Promise<AtcGatewayRouting> {
    const record = await this.routingRepo.updateStatus(routingId, 'routing')
    await this.audit.append(record.id, 'routing.activated', { routingId: record.routingId })
    this.bus.emit('gateway_route_established', { routingId: record.routingId }).catch(() => undefined)
    return record
  }

  async suspendRouting(routingId: string): Promise<AtcGatewayRouting> {
    const record = await this.routingRepo.updateStatus(routingId, 'suspended')
    await this.audit.append(record.id, 'routing.suspended', { routingId: record.routingId })
    this.bus.emit('routing.suspended', { routingId: record.routingId }).catch(() => undefined)
    return record
  }

  async expireRouting(routingId: string): Promise<AtcGatewayRouting> {
    const record = await this.routingRepo.updateStatus(routingId, 'expired')
    await this.audit.append(record.id, 'routing.expired', { routingId: record.routingId })
    this.bus.emit('routing.expired', { routingId: record.routingId }).catch(() => undefined)
    return record
  }

  async getRouting(routingId: string): Promise<AtcGatewayRouting | null> {
    return this.routingRepo.findByRoutingId(routingId)
  }
}
