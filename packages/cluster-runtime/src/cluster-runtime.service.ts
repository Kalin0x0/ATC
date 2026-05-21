import type { ClusterNodeRepository, AtcClusterNode, RegisterNodeParams } from './cluster-node.repository.js'
import type { ClusterAuditRepository } from './cluster-audit.repository.js'
import type { ClusterRuntimeEventBus } from './distributed-deployment-recovery.service.js'

export class ClusterRuntimeService {
  constructor(
    private nodeRepo: ClusterNodeRepository,
    private auditRepo: ClusterAuditRepository,
    private eventBus: ClusterRuntimeEventBus,
  ) {}

  async registerNode(params: RegisterNodeParams): Promise<AtcClusterNode> {
    const node = await this.nodeRepo.register(params)
    await this.auditRepo.append({ nodeId: node.nodeId, eventType: 'node_registered' })
    this.eventBus.emit('atc:cluster:node:registered', { nodeId: node.nodeId }).catch(() => undefined)
    return node
  }

  async deregisterNode(id: string): Promise<AtcClusterNode> {
    const node = await this.nodeRepo.updateStatus(id, 'offline', new Date())
    await this.auditRepo.append({ nodeId: node.nodeId, eventType: 'node_deregistered' })
    this.eventBus.emit('atc:cluster:node:deregistered', { nodeId: node.nodeId }).catch(() => undefined)
    return node
  }

  async getNode(id: string): Promise<AtcClusterNode | null> {
    return this.nodeRepo.findById(id)
  }

  async listActiveNodes(ownerServerId?: string): Promise<AtcClusterNode[]> {
    return this.nodeRepo.listActive(ownerServerId)
  }
}
