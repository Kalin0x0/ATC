import type { RuntimeAllocationRepository, AtcRuntimeAllocation, CreateAllocationParams } from './runtime-allocation.repository.js'
import type { ClusterAuditRepository } from './cluster-audit.repository.js'
import type { ClusterRuntimeEventBus } from './distributed-deployment-recovery.service.js'

export class ClusterAllocationService {
  constructor(
    private allocationRepo: RuntimeAllocationRepository,
    private auditRepo: ClusterAuditRepository,
    private eventBus: ClusterRuntimeEventBus,
  ) {}

  async allocate(params: CreateAllocationParams): Promise<AtcRuntimeAllocation> {
    const allocation = await this.allocationRepo.upsert(params)
    this.eventBus.emit('atc:cluster:allocation:allocated', { entityId: allocation.entityId, nodeId: allocation.nodeId }).catch(() => undefined)
    return allocation
  }

  async getAllocation(entityId: string): Promise<AtcRuntimeAllocation | null> {
    return this.allocationRepo.findByEntity(entityId)
  }

  async deallocate(entityId: string): Promise<void> {
    await this.allocationRepo.release(entityId)
    await this.auditRepo.append({ eventType: 'allocation_released', auditData: { entityId } })
    this.eventBus.emit('atc:cluster:allocation:released', { entityId }).catch(() => undefined)
  }
}
