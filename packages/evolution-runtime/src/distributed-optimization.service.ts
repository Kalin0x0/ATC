import type { DistributedOptimizationRepository, AtcDistributedOptimization, AtcDistributedOptType } from './distributed-optimization.repository.js'
import type { EvolutionAuditRepository } from './evolution-audit.repository.js'
import type { EvolutionRuntimeEventBus } from './evolution-recovery.service.js'

export interface UpsertDistributedOptServiceParams {
  nodeId: string
  optType: AtcDistributedOptType
  ownerServerId: string
  optData?: Record<string, unknown> | undefined
}

export class DistributedOptimizationService {
  constructor(
    private readonly distributedRepo: DistributedOptimizationRepository,
    private readonly auditRepo: EvolutionAuditRepository,
    private readonly eventBus: EvolutionRuntimeEventBus,
  ) {}

  async upsertOptimization(params: UpsertDistributedOptServiceParams): Promise<AtcDistributedOptimization> {
    const optimization = await this.distributedRepo.upsert(params)
    this.eventBus.emit('atc:evolution:distributed:upserted', { nodeId: optimization.nodeId, optType: optimization.optType, status: optimization.status }).catch(() => undefined)
    return optimization
  }

  async failNode(nodeId: string): Promise<void> {
    await this.distributedRepo.failNode(nodeId)
    this.eventBus.emit('atc:evolution:distributed:node:failed', { nodeId }).catch(() => undefined)
  }

  async getOptimization(nodeId: string): Promise<AtcDistributedOptimization | null> {
    return this.distributedRepo.findByNode(nodeId)
  }
}
