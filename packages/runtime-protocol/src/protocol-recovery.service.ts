import type { RuntimeProtocolRepository } from './runtime-protocol.repository.js'
import type { FederationContractRepository } from './federation-contract.repository.js'
import type { RuntimeHandshakeRepository } from './runtime-handshake.repository.js'
import type { ProtocolBridgeRepository } from './protocol-bridge.repository.js'
import type { ProtocolAuditRepository } from './protocol-audit.repository.js'

export interface RuntimeProtocolEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export interface ProtocolCleanupResult {
  protocols: number
  contracts: number
  handshakes: number
  bridges: number
}

export class ProtocolRecoveryService {
  constructor(
    private protocolRepo: RuntimeProtocolRepository,
    private contractRepo: FederationContractRepository,
    private handshakeRepo: RuntimeHandshakeRepository,
    private bridgeRepo: ProtocolBridgeRepository,
    private auditRepo: ProtocolAuditRepository,
    private eventBus: RuntimeProtocolEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<ProtocolCleanupResult> {
    const [protocols, contracts, handshakes, bridges] = await Promise.all([
      this.protocolRepo.cleanupStale(thresholdMs),
      this.contractRepo.cleanupStale(thresholdMs),
      this.handshakeRepo.cleanupStale(thresholdMs),
      this.bridgeRepo.cleanupStale(thresholdMs),
    ])

    await this.auditRepo.append({
      eventType: 'cleanup_completed',
      auditData: { protocols, contracts, handshakes, bridges },
    })

    this.eventBus
      .emit('atc:runtime-protocol:cleanup:completed', { protocols, contracts, handshakes, bridges })
      .catch(() => undefined)

    return { protocols, contracts, handshakes, bridges }
  }
}
