import type { FederationNodeRepository, AtcFederationNode, RegisterFederationNodeParams } from './federation-node.repository.js'
import type { FederationAuditRepository } from './federation-audit.repository.js'
import type { FederationRuntimeEventBus } from './federation-recovery.service.js'

export class FederationRuntimeService {
  constructor(
    private nodeRepo: FederationNodeRepository,
    private auditRepo: FederationAuditRepository,
    private eventBus: FederationRuntimeEventBus,
  ) {}

  async registerNode(params: RegisterFederationNodeParams): Promise<AtcFederationNode> {
    const node = await this.nodeRepo.register(params)
    await this.auditRepo.append({ federationNodeId: node.nodeId, eventType: 'node_registered' })
    this.eventBus.emit('atc:federation:node:registered', { nodeId: node.nodeId }).catch(() => undefined)
    return node
  }

  async deregisterNode(id: string): Promise<AtcFederationNode> {
    const node = await this.nodeRepo.updateStatus(id, 'offline', new Date())
    await this.auditRepo.append({ federationNodeId: node.nodeId, eventType: 'node_deregistered' })
    this.eventBus.emit('atc:federation:node:deregistered', { nodeId: node.nodeId }).catch(() => undefined)
    return node
  }

  async getNode(id: string): Promise<AtcFederationNode | null> {
    return this.nodeRepo.findById(id)
  }

  async listActiveNodes(regionId?: string): Promise<AtcFederationNode[]> {
    return this.nodeRepo.listActive(regionId)
  }
}
