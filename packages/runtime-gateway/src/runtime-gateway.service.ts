import type { RuntimeGatewayRepository, AtcRuntimeGateway, CreateGatewayParams } from './runtime-gateway.repository.js'
import type { GatewayAuditRepository } from './gateway-audit.repository.js'

export interface RuntimeGatewayEventBus {
  emit(event: string, data: Record<string, unknown>): Promise<void>
}

export class RuntimeGatewayService {
  constructor(
    private readonly repo: RuntimeGatewayRepository,
    private readonly audit: GatewayAuditRepository,
    private readonly bus: RuntimeGatewayEventBus
  ) {}

  async createGateway(params: CreateGatewayParams): Promise<AtcRuntimeGateway> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'gateway.created', { gatewayId: record.gatewayId })
    this.bus.emit('gateway.created', { gatewayId: record.gatewayId }).catch(() => undefined)
    return record
  }

  async activateGateway(id: string): Promise<AtcRuntimeGateway> {
    const record = await this.repo.updateStatus(id, 'active', new Date())
    await this.audit.append(record.id, 'gateway.activated', { gatewayId: record.gatewayId })
    this.bus.emit('gateway_route_established', { gatewayId: record.gatewayId }).catch(() => undefined)
    return record
  }

  async suspendGateway(id: string): Promise<AtcRuntimeGateway> {
    const record = await this.repo.updateStatus(id, 'suspended')
    await this.audit.append(record.id, 'gateway.suspended', { gatewayId: record.gatewayId })
    this.bus.emit('gateway.suspended', { gatewayId: record.gatewayId }).catch(() => undefined)
    return record
  }

  async expireGateway(id: string): Promise<AtcRuntimeGateway> {
    const record = await this.repo.updateStatus(id, 'expired')
    await this.audit.append(record.id, 'gateway.expired', { gatewayId: record.gatewayId })
    this.bus.emit('gateway.expired', { gatewayId: record.gatewayId }).catch(() => undefined)
    return record
  }

  async failGateway(id: string): Promise<AtcRuntimeGateway> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.audit.append(record.id, 'gateway.failed', { gatewayId: record.gatewayId })
    this.bus.emit('gateway.failed', { gatewayId: record.gatewayId }).catch(() => undefined)
    return record
  }

  async getGateway(id: string): Promise<AtcRuntimeGateway | null> {
    return this.repo.findById(id)
  }
}
