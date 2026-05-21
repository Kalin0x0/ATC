import type { RuntimeGatewayRepository } from './runtime-gateway.repository.js'
import type { AccessMeshRepository } from './access-mesh.repository.js'
import type { GatewayRoutingRepository } from './gateway-routing.repository.js'
import type { RuntimeExposureRepository } from './runtime-exposure.repository.js'
import type { SurfaceProtectionRepository } from './surface-protection.repository.js'
import type { GatewayAuditRepository } from './gateway-audit.repository.js'
import type { RuntimeGatewayEventBus } from './runtime-gateway.service.js'

export interface GatewayCleanupResult {
  gateways: number
  meshNodes: number
  routings: number
  exposures: number
  protections: number
}

export class GatewayRecoveryService {
  constructor(
    private readonly gatewayRepo: RuntimeGatewayRepository,
    private readonly meshRepo: AccessMeshRepository,
    private readonly routingRepo: GatewayRoutingRepository,
    private readonly exposureRepo: RuntimeExposureRepository,
    private readonly protectionRepo: SurfaceProtectionRepository,
    private readonly audit: GatewayAuditRepository,
    private readonly bus: RuntimeGatewayEventBus
  ) {}

  async cleanupStale(thresholdMs: number): Promise<GatewayCleanupResult> {
    const [gateways, meshNodes, routings, exposures, protections] = await Promise.all([
      this.gatewayRepo.cleanupStale(thresholdMs),
      this.meshRepo.cleanupStale(thresholdMs),
      this.routingRepo.cleanupStale(thresholdMs),
      this.exposureRepo.cleanupStale(thresholdMs),
      this.protectionRepo.cleanupStale(thresholdMs),
    ])
    this.bus.emit('gateway.stale_cleaned', { gateways, meshNodes, routings, exposures, protections }).catch(() => undefined)
    return { gateways, meshNodes, routings, exposures, protections }
  }
}
