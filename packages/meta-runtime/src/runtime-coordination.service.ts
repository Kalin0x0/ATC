import type { RuntimeCoordinationRepository, AtcRuntimeCoordination, AtcCoordinationType } from './runtime-coordination.repository.js'
import type { MetaAuditRepository } from './meta-audit.repository.js'
import type { MetaRuntimeEventBus } from './self-healing-recovery.service.js'

export interface UpsertCoordinationParams {
  nodeId: string
  coordinationType: AtcCoordinationType
  ownerServerId: string
  coordinationData?: Record<string, unknown> | undefined
}

export class RuntimeCoordinationService {
  constructor(
    private readonly coordinationRepo: RuntimeCoordinationRepository,
    private readonly auditRepo: MetaAuditRepository,
    private readonly eventBus: MetaRuntimeEventBus,
  ) {}

  async upsertCoordination(params: UpsertCoordinationParams): Promise<AtcRuntimeCoordination> {
    const coordination = await this.coordinationRepo.upsert(params)
    this.eventBus.emit('atc:meta:coordination:updated', { nodeId: coordination.nodeId, coordinationType: coordination.coordinationType, status: coordination.status }).catch(() => undefined)
    return coordination
  }

  async failNode(nodeId: string): Promise<void> {
    await this.coordinationRepo.failNode(nodeId)
    this.eventBus.emit('atc:meta:node:failed', { nodeId }).catch(() => undefined)
  }

  async getCoordination(nodeId: string): Promise<AtcRuntimeCoordination | null> {
    return this.coordinationRepo.findByNode(nodeId)
  }
}
