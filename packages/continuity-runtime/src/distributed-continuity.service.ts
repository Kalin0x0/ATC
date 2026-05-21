import type { InfinitePersistenceRepository, AtcInfinitePersistence, AtcPersistenceNodeType } from './infinite-persistence.repository.js'
import type { ContinuityAuditRepository } from './continuity-audit.repository.js'
import type { ContinuityRuntimeEventBus } from './temporal-integrity-recovery.service.js'

export interface UpsertContinuityNodeServiceParams {
  nodeId: string
  nodeType: AtcPersistenceNodeType
  ownerServerId: string
  persistenceData?: Record<string, unknown> | undefined
}

export class DistributedContinuityService {
  constructor(
    private repo: InfinitePersistenceRepository,
    private audit: ContinuityAuditRepository,
    private eventBus: ContinuityRuntimeEventBus,
  ) {}

  async upsertContinuityNode(params: UpsertContinuityNodeServiceParams): Promise<AtcInfinitePersistence> {
    const record = await this.repo.upsert({
      nodeId: params.nodeId,
      nodeType: params.nodeType,
      ownerServerId: params.ownerServerId,
      persistenceData: params.persistenceData,
    })
    await this.audit.append({
      eventType: 'continuity_node_upserted',
      ownerServerId: record.ownerServerId,
      auditData: { nodeId: record.nodeId, nodeType: record.nodeType },
    })
    this.eventBus.emit('atc:continuity:node:upserted', { nodeId: record.nodeId }).catch(() => undefined)
    return record
  }

  async failContinuityNode(nodeId: string): Promise<void> {
    const record = await this.repo.failNode(nodeId)
    await this.audit.append({
      eventType: 'continuity_node_failed',
      ownerServerId: record.ownerServerId,
      auditData: { nodeId: record.nodeId },
    })
    this.eventBus.emit('atc:continuity:node:failed', { nodeId: record.nodeId }).catch(() => undefined)
  }

  async getContinuityNode(nodeId: string): Promise<AtcInfinitePersistence | null> {
    return this.repo.findByNodeId(nodeId)
  }
}
