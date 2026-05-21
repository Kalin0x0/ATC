import type { InfinitePersistenceRepository, AtcInfinitePersistence, AtcPersistenceNodeType } from './infinite-persistence.repository.js'
import type { ContinuityAuditRepository } from './continuity-audit.repository.js'
import type { ContinuityRuntimeEventBus } from './temporal-integrity-recovery.service.js'

export interface UpsertPersistenceNodeServiceParams {
  nodeId: string
  nodeType: AtcPersistenceNodeType
  ownerServerId: string
  persistenceData?: Record<string, unknown> | undefined
}

export class InfinitePersistenceService {
  constructor(
    private repo: InfinitePersistenceRepository,
    private audit: ContinuityAuditRepository,
    private eventBus: ContinuityRuntimeEventBus,
  ) {}

  async upsertPersistenceNode(params: UpsertPersistenceNodeServiceParams): Promise<AtcInfinitePersistence> {
    const record = await this.repo.upsert({
      nodeId: params.nodeId,
      nodeType: params.nodeType,
      ownerServerId: params.ownerServerId,
      persistenceData: params.persistenceData,
    })
    await this.audit.append({
      eventType: 'persistence_node_upserted',
      ownerServerId: record.ownerServerId,
      auditData: { nodeId: record.nodeId, nodeType: record.nodeType },
    })
    this.eventBus.emit('atc:continuity:persistence:upserted', { nodeId: record.nodeId }).catch(() => undefined)
    return record
  }

  async failNode(nodeId: string): Promise<void> {
    const record = await this.repo.failNode(nodeId)
    await this.audit.append({
      eventType: 'persistence_node_failed',
      ownerServerId: record.ownerServerId,
      auditData: { nodeId: record.nodeId },
    })
    this.eventBus.emit('atc:continuity:persistence:failed', { nodeId: record.nodeId }).catch(() => undefined)
  }

  async getPersistenceNode(nodeId: string): Promise<AtcInfinitePersistence | null> {
    return this.repo.findByNodeId(nodeId)
  }
}
