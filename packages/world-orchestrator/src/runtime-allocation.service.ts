import type {
  RuntimeAllocationRepository,
  AtcRuntimeAllocation,
  CreateAllocationParams,
} from './runtime-allocation.repository.js'
import type { WorldOrchestrationAuditRepository } from './world-orchestration-audit.repository.js'

export class RuntimeAllocationService {
  constructor(
    private readonly allocationRepo: RuntimeAllocationRepository,
    private readonly auditRepo: WorldOrchestrationAuditRepository,
  ) {}

  async createAllocation(params: CreateAllocationParams): Promise<AtcRuntimeAllocation> {
    const allocation = await this.allocationRepo.create(params)

    await this.auditRepo.record(
      allocation.allocationId,
      'allocation:created',
      allocation.serverId,
      {
        shardId: allocation.shardId,
        allocationType: allocation.allocationType,
      },
    )

    return allocation
  }

  async listActiveAllocations(): Promise<AtcRuntimeAllocation[]> {
    return this.allocationRepo.listActive()
  }

  async drainAllocation(allocationId: string): Promise<AtcRuntimeAllocation> {
    const allocation = await this.allocationRepo.transition(allocationId, 'draining')

    await this.auditRepo.record(
      allocationId,
      'allocation:draining',
      allocation.serverId,
      { shardId: allocation.shardId },
    )

    return allocation
  }

  async deallocate(allocationId: string): Promise<AtcRuntimeAllocation> {
    const allocation = await this.allocationRepo.transition(allocationId, 'deallocated')

    await this.auditRepo.record(
      allocationId,
      'allocation:deallocated',
      allocation.serverId,
      { shardId: allocation.shardId },
    )

    return allocation
  }
}
