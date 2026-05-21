import type { NodeLifecycleRepository, AtcNodeLifecycle, UpsertLifecycleParams } from './node-lifecycle.repository.js'
import type { ClusterAuditRepository } from './cluster-audit.repository.js'
import type { ClusterRuntimeEventBus } from './distributed-deployment-recovery.service.js'

export class NodeLifecycleService {
  constructor(
    private lifecycleRepo: NodeLifecycleRepository,
    private auditRepo: ClusterAuditRepository,
    private eventBus: ClusterRuntimeEventBus,
  ) {}

  async upsertLifecycle(params: UpsertLifecycleParams): Promise<AtcNodeLifecycle> {
    const lifecycle = await this.lifecycleRepo.upsert(params)
    this.eventBus.emit('atc:cluster:lifecycle:updated', { nodeId: lifecycle.nodeId, status: lifecycle.status }).catch(() => undefined)
    return lifecycle
  }

  async getLifecycle(nodeId: string): Promise<AtcNodeLifecycle | null> {
    return this.lifecycleRepo.findByNodeId(nodeId)
  }

  async deactivateLifecycle(nodeId: string): Promise<void> {
    await this.lifecycleRepo.deactivate(nodeId)
    await this.auditRepo.append({ nodeId, eventType: 'lifecycle_deactivated' })
    this.eventBus.emit('atc:cluster:lifecycle:deactivated', { nodeId }).catch(() => undefined)
  }
}
