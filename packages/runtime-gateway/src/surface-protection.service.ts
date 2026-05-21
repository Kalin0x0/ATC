import type { SurfaceProtectionRepository, AtcSurfaceProtection, CreateProtectionParams } from './surface-protection.repository.js'
import type { GatewayAuditRepository } from './gateway-audit.repository.js'
import type { RuntimeGatewayEventBus } from './runtime-gateway.service.js'

export class RuntimeSurfaceProtectionService {
  constructor(
    private readonly protectionRepo: SurfaceProtectionRepository,
    private readonly audit: GatewayAuditRepository,
    private readonly bus: RuntimeGatewayEventBus
  ) {}

  async createProtection(params: CreateProtectionParams): Promise<AtcSurfaceProtection> {
    const record = await this.protectionRepo.create(params)
    await this.audit.append(record.id, 'protection.created', { protectionId: record.protectionId })
    this.bus.emit('protection.created', { protectionId: record.protectionId }).catch(() => undefined)
    return record
  }

  async activateProtection(id: string): Promise<AtcSurfaceProtection> {
    const record = await this.protectionRepo.updateStatus(id, 'active', new Date())
    await this.audit.append(record.id, 'protection.activated', { protectionId: record.protectionId })
    this.bus.emit('runtime_surface_secured', { protectionId: record.protectionId }).catch(() => undefined)
    return record
  }

  async breachProtection(id: string): Promise<AtcSurfaceProtection> {
    const record = await this.protectionRepo.updateStatus(id, 'breached')
    await this.audit.append(record.id, 'protection.breached', { protectionId: record.protectionId })
    this.bus.emit('protection.breached', { protectionId: record.protectionId }).catch(() => undefined)
    return record
  }

  async expireProtection(id: string): Promise<AtcSurfaceProtection> {
    const record = await this.protectionRepo.updateStatus(id, 'expired')
    await this.audit.append(record.id, 'protection.expired', { protectionId: record.protectionId })
    this.bus.emit('protection.expired', { protectionId: record.protectionId }).catch(() => undefined)
    return record
  }

  async getProtection(id: string): Promise<AtcSurfaceProtection | null> {
    return this.protectionRepo.findById(id)
  }
}
