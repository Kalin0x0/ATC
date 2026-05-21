import type { RuntimeProtocolRepository, AtcRuntimeProtocol } from './runtime-protocol.repository.js'
import type { AtcProtocolType } from './runtime-protocol.repository.js'
import type { ProtocolAuditRepository } from './protocol-audit.repository.js'
import type { RuntimeProtocolEventBus } from './protocol-recovery.service.js'
import { generateId } from './id.js'

export interface RegisterProtocolServiceParams {
  protocolType: AtcProtocolType
  ownerServerId: string
  protocolNonce: string
  protocolData?: Record<string, unknown> | undefined
}

export class RuntimeProtocolService {
  constructor(
    private protocolRepo: RuntimeProtocolRepository,
    private auditRepo: ProtocolAuditRepository,
    private eventBus: RuntimeProtocolEventBus,
  ) {}

  async registerProtocol(params: RegisterProtocolServiceParams): Promise<AtcRuntimeProtocol> {
    const protocol = await this.protocolRepo.create({
      protocolId: generateId(),
      protocolType: params.protocolType,
      ownerServerId: params.ownerServerId,
      protocolNonce: params.protocolNonce,
      protocolData: params.protocolData,
    })

    try {
      await this.auditRepo.append({
        eventType: 'protocol_registered',
        protocolId: protocol.protocolId,
        ownerServerId: protocol.ownerServerId,
        auditData: { protocolType: protocol.protocolType },
      })
    } catch { /* audit failure must not break main operation */ }

    this.eventBus
      .emit('atc:runtime-protocol:protocol:registered', {
        id: protocol.id,
        protocolId: protocol.protocolId,
        protocolType: protocol.protocolType,
      })
      .catch(() => undefined)

    return protocol
  }

  async pauseProtocol(id: string): Promise<AtcRuntimeProtocol> {
    const protocol = await this.protocolRepo.updateStatus(id, 'paused')

    try {
      await this.auditRepo.append({
        eventType: 'protocol_paused',
        protocolId: protocol.protocolId,
        ownerServerId: protocol.ownerServerId,
      })
    } catch { /* audit failure must not break main operation */ }

    this.eventBus
      .emit('atc:runtime-protocol:protocol:paused', { id: protocol.id, protocolId: protocol.protocolId })
      .catch(() => undefined)

    return protocol
  }

  async terminateProtocol(id: string): Promise<AtcRuntimeProtocol> {
    const protocol = await this.protocolRepo.updateStatus(id, 'terminated')

    try {
      await this.auditRepo.append({
        eventType: 'protocol_terminated',
        protocolId: protocol.protocolId,
        ownerServerId: protocol.ownerServerId,
      })
    } catch { /* audit failure must not break main operation */ }

    this.eventBus
      .emit('atc:runtime-protocol:protocol:terminated', { id: protocol.id, protocolId: protocol.protocolId })
      .catch(() => undefined)

    return protocol
  }

  async getProtocol(id: string): Promise<AtcRuntimeProtocol | null> {
    return this.protocolRepo.findById(id)
  }

  async listActiveProtocols(ownerServerId?: string | undefined): Promise<AtcRuntimeProtocol[]> {
    return this.protocolRepo.listActive(ownerServerId)
  }
}
