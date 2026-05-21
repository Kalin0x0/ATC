import type { MetaRuntimeRepository } from './meta-runtime.repository.js'
import type { HealingOperationRepository } from './healing-operation.repository.js'
import type { DistributedRepairRepository } from './distributed-repair.repository.js'
import type { MetaAllocationRepository } from './meta-allocation.repository.js'
import type { MetaAuditRepository } from './meta-audit.repository.js'

export interface MetaRuntimeEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export class SelfHealingRecoveryService {
  constructor(
    private readonly metaRepo: MetaRuntimeRepository,
    private readonly healingRepo: HealingOperationRepository,
    private readonly repairRepo: DistributedRepairRepository,
    private readonly allocationRepo: MetaAllocationRepository,
    private readonly auditRepo: MetaAuditRepository,
    private readonly eventBus: MetaRuntimeEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<{ metas: number; healings: number; repairs: number; allocations: number }> {
    const [metas, healings, repairs, allocations] = await Promise.all([
      this.metaRepo.cleanupStale(thresholdMs),
      this.healingRepo.cleanupStale(thresholdMs),
      this.repairRepo.cleanupStale(thresholdMs),
      this.allocationRepo.cleanupReleased(thresholdMs),
    ])

    await this.auditRepo.append({
      eventType: 'cleanup_completed',
      auditData: { metas, healings, repairs, allocations },
    })
    this.eventBus.emit('atc:meta:cleanup:completed', { metas, healings, repairs, allocations }).catch(() => undefined)

    return { metas, healings, repairs, allocations }
  }
}
