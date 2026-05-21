import type { ClusterNodeRepository } from './cluster-node.repository.js'
import type { RuntimeDeploymentRepository } from './runtime-deployment.repository.js'
import type { RuntimeAllocationRepository } from './runtime-allocation.repository.js'
import type { ClusterAuditRepository } from './cluster-audit.repository.js'

export interface ClusterRuntimeEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export class DistributedDeploymentRecoveryService {
  constructor(
    private nodeRepo: ClusterNodeRepository,
    private deploymentRepo: RuntimeDeploymentRepository,
    private allocationRepo: RuntimeAllocationRepository,
    private auditRepo: ClusterAuditRepository,
    private eventBus: ClusterRuntimeEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<{ nodes: number; deployments: number; allocations: number }> {
    const [nodes, deployments, allocations] = await Promise.all([
      this.nodeRepo.cleanupStale(thresholdMs),
      this.deploymentRepo.cleanupStale(thresholdMs),
      this.allocationRepo.cleanupReleased(thresholdMs),
    ])
    await this.auditRepo.append({ eventType: 'cleanup_completed', auditData: { nodes, deployments, allocations } })
    this.eventBus.emit('atc:cluster:cleanup:completed', { nodes, deployments, allocations }).catch(() => undefined)
    return { nodes, deployments, allocations }
  }
}
