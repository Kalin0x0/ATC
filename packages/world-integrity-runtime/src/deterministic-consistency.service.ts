import type { RuntimeConsistencyRepository, AtcRuntimeConsistency, AtcConsistencyType } from './runtime-consistency.repository.js'
import type { IntegrityAuditRepository } from './integrity-audit.repository.js'
import type { WorldIntegrityEventBus } from './integrity-recovery.service.js'

export interface UpsertConsistencyServiceParams {
  nodeId: string
  consistencyType: AtcConsistencyType
  ownerServerId: string
  consistencyData?: Record<string, unknown> | undefined
}

export class DeterministicConsistencyService {
  constructor(
    private consistencyRepo: RuntimeConsistencyRepository,
    private auditRepo: IntegrityAuditRepository,
    private eventBus: WorldIntegrityEventBus,
  ) {}

  async upsertConsistency(params: UpsertConsistencyServiceParams): Promise<AtcRuntimeConsistency> {
    const record = await this.consistencyRepo.upsert({
      nodeId: params.nodeId,
      consistencyType: params.consistencyType,
      ownerServerId: params.ownerServerId,
      consistencyData: params.consistencyData,
    })
    await this.auditRepo.append({
      eventType: 'consistency_upserted',
      ownerServerId: record.ownerServerId,
      auditData: { nodeId: record.nodeId, consistencyType: record.consistencyType },
    })
    this.eventBus.emit('atc:world-integrity:consistency:upserted', { nodeId: record.nodeId }).catch(() => undefined)
    return record
  }

  async markDiverged(nodeId: string): Promise<void> {
    const record = await this.consistencyRepo.markDiverged(nodeId)
    await this.auditRepo.append({
      eventType: 'consistency_diverged',
      ownerServerId: record.ownerServerId,
      auditData: { nodeId: record.nodeId },
    })
    this.eventBus.emit('atc:world-integrity:consistency:diverged', { nodeId: record.nodeId }).catch(() => undefined)
  }

  async getConsistency(nodeId: string): Promise<AtcRuntimeConsistency | null> {
    return this.consistencyRepo.findByNodeId(nodeId)
  }
}
