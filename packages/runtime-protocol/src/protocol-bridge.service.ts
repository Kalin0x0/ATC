import type { ProtocolBridgeRepository, AtcProtocolBridge } from './protocol-bridge.repository.js'
import type { AtcBridgeType } from './protocol-bridge.repository.js'
import type { ProtocolAuditRepository } from './protocol-audit.repository.js'
import type { RuntimeProtocolEventBus } from './protocol-recovery.service.js'

export interface UpsertBridgeServiceParams {
  bridgeId: string
  bridgeType: AtcBridgeType
  ownerServerId: string
  remoteServerId: string
  bridgeData?: Record<string, unknown> | undefined
}

export class InterSystemBridgeService {
  constructor(
    private bridgeRepo: ProtocolBridgeRepository,
    private auditRepo: ProtocolAuditRepository,
    private eventBus: RuntimeProtocolEventBus,
  ) {}

  async upsertBridge(params: UpsertBridgeServiceParams): Promise<AtcProtocolBridge> {
    const bridge = await this.bridgeRepo.upsert({
      bridgeId: params.bridgeId,
      bridgeType: params.bridgeType,
      ownerServerId: params.ownerServerId,
      remoteServerId: params.remoteServerId,
      bridgeData: params.bridgeData,
    })

    try {
      await this.auditRepo.append({
        eventType: 'bridge_upserted',
        ownerServerId: bridge.ownerServerId,
        auditData: {
          bridgeId: bridge.bridgeId,
          bridgeType: bridge.bridgeType,
          remoteServerId: bridge.remoteServerId,
        },
      })
    } catch { /* audit failure must not break main operation */ }

    this.eventBus
      .emit('atc:runtime-protocol:bridge:upserted', {
        bridgeId: bridge.bridgeId,
        bridgeType: bridge.bridgeType,
      })
      .catch(() => undefined)

    return bridge
  }

  async failBridge(bridgeId: string): Promise<AtcProtocolBridge> {
    const bridge = await this.bridgeRepo.failBridge(bridgeId)

    try {
      await this.auditRepo.append({
        eventType: 'bridge_failed',
        ownerServerId: bridge.ownerServerId,
        auditData: { bridgeId: bridge.bridgeId },
      })
    } catch { /* audit failure must not break main operation */ }

    this.eventBus
      .emit('atc:runtime-protocol:bridge:failed', { bridgeId: bridge.bridgeId })
      .catch(() => undefined)

    return bridge
  }

  async getBridge(bridgeId: string): Promise<AtcProtocolBridge | null> {
    return this.bridgeRepo.findByBridgeId(bridgeId)
  }
}
