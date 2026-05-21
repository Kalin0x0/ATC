import type { RuntimeHandshakeRepository, AtcRuntimeHandshake } from './runtime-handshake.repository.js'
import type { AtcHandshakeType } from './runtime-handshake.repository.js'
import type { ProtocolAuditRepository } from './protocol-audit.repository.js'
import type { RuntimeProtocolEventBus } from './protocol-recovery.service.js'
import { generateId } from './id.js'

export interface InitiateHandshakeServiceParams {
  handshakeType: AtcHandshakeType
  ownerServerId: string
  remoteServerId: string
  handshakeNonce: string
  handshakeData?: Record<string, unknown> | undefined
}

export class RuntimeHandshakeService {
  constructor(
    private handshakeRepo: RuntimeHandshakeRepository,
    private auditRepo: ProtocolAuditRepository,
    private eventBus: RuntimeProtocolEventBus,
  ) {}

  async initiateHandshake(params: InitiateHandshakeServiceParams): Promise<AtcRuntimeHandshake> {
    const handshake = await this.handshakeRepo.create({
      handshakeId: generateId(),
      handshakeType: params.handshakeType,
      ownerServerId: params.ownerServerId,
      remoteServerId: params.remoteServerId,
      handshakeNonce: params.handshakeNonce,
      handshakeData: params.handshakeData,
    })

    try {
      await this.auditRepo.append({
        eventType: 'handshake_initiated',
        ownerServerId: handshake.ownerServerId,
        auditData: {
          handshakeId: handshake.handshakeId,
          handshakeType: handshake.handshakeType,
          remoteServerId: handshake.remoteServerId,
        },
      })
    } catch { /* audit failure must not break main operation */ }

    this.eventBus
      .emit('atc:runtime-protocol:handshake:initiated', {
        id: handshake.id,
        handshakeId: handshake.handshakeId,
      })
      .catch(() => undefined)

    return handshake
  }

  async acknowledgeHandshake(id: string): Promise<AtcRuntimeHandshake> {
    const handshake = await this.handshakeRepo.updateStatus(id, 'acknowledged')

    try {
      await this.auditRepo.append({
        eventType: 'handshake_acknowledged',
        ownerServerId: handshake.ownerServerId,
        auditData: { handshakeId: handshake.handshakeId },
      })
    } catch { /* audit failure must not break main operation */ }

    this.eventBus
      .emit('atc:runtime-protocol:handshake:acknowledged', { id: handshake.id, handshakeId: handshake.handshakeId })
      .catch(() => undefined)

    return handshake
  }

  async completeHandshake(id: string): Promise<AtcRuntimeHandshake> {
    const handshake = await this.handshakeRepo.updateStatus(id, 'completed', new Date())

    try {
      await this.auditRepo.append({
        eventType: 'handshake_completed',
        ownerServerId: handshake.ownerServerId,
        auditData: { handshakeId: handshake.handshakeId },
      })
    } catch { /* audit failure must not break main operation */ }

    this.eventBus
      .emit('atc:runtime-protocol:handshake:completed', { id: handshake.id, handshakeId: handshake.handshakeId })
      .catch(() => undefined)

    return handshake
  }

  async rejectHandshake(id: string): Promise<AtcRuntimeHandshake> {
    const handshake = await this.handshakeRepo.updateStatus(id, 'rejected')

    try {
      await this.auditRepo.append({
        eventType: 'handshake_rejected',
        ownerServerId: handshake.ownerServerId,
        auditData: { handshakeId: handshake.handshakeId },
      })
    } catch { /* audit failure must not break main operation */ }

    this.eventBus
      .emit('atc:runtime-protocol:handshake:rejected', { id: handshake.id, handshakeId: handshake.handshakeId })
      .catch(() => undefined)

    return handshake
  }

  async getHandshake(id: string): Promise<AtcRuntimeHandshake | null> {
    return this.handshakeRepo.findById(id)
  }
}
