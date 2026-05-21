import type { ProtocolRegistryRepository, AtcProtocolRegistryEntry } from './protocol-registry.repository.js'
import type { AtcRegistryEntryType } from './protocol-registry.repository.js'
import type { ProtocolAuditRepository } from './protocol-audit.repository.js'
import type { RuntimeProtocolEventBus } from './protocol-recovery.service.js'

export interface UpsertRegistryServiceParams {
  nodeId: string
  entryType: AtcRegistryEntryType
  ownerServerId: string
  endpointData?: Record<string, unknown> | undefined
}

export class DistributedContractRegistry {
  constructor(
    private registryRepo: ProtocolRegistryRepository,
    private auditRepo: ProtocolAuditRepository,
    private eventBus: RuntimeProtocolEventBus,
  ) {}

  async upsertRegistry(params: UpsertRegistryServiceParams): Promise<AtcProtocolRegistryEntry> {
    const entry = await this.registryRepo.upsert({
      nodeId: params.nodeId,
      entryType: params.entryType,
      ownerServerId: params.ownerServerId,
      endpointData: params.endpointData,
    })

    try {
      await this.auditRepo.append({
        eventType: 'registry_upserted',
        ownerServerId: entry.ownerServerId,
        auditData: { nodeId: entry.nodeId, entryType: entry.entryType },
      })
    } catch { /* audit failure must not break main operation */ }

    this.eventBus
      .emit('atc:runtime-protocol:registry:upserted', { nodeId: entry.nodeId, entryType: entry.entryType })
      .catch(() => undefined)

    return entry
  }

  async deregisterNode(nodeId: string): Promise<AtcProtocolRegistryEntry> {
    const entry = await this.registryRepo.updateStatus(nodeId, 'deregistered')

    try {
      await this.auditRepo.append({
        eventType: 'registry_deregistered',
        ownerServerId: entry.ownerServerId,
        auditData: { nodeId: entry.nodeId },
      })
    } catch { /* audit failure must not break main operation */ }

    this.eventBus
      .emit('atc:runtime-protocol:registry:deregistered', { nodeId: entry.nodeId })
      .catch(() => undefined)

    return entry
  }

  async getRegistryEntry(nodeId: string): Promise<AtcProtocolRegistryEntry | null> {
    return this.registryRepo.findByNodeId(nodeId)
  }
}
