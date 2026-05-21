import type { CheckpointRuntimeRepository, AtcCheckpointRuntime, AtcCheckpointType } from './checkpoint-runtime.repository.js'
import type { ContinuityAuditRepository } from './continuity-audit.repository.js'
import type { ContinuityRuntimeEventBus } from './temporal-integrity-recovery.service.js'

export interface CreateCheckpointServiceParams {
  checkpointType: AtcCheckpointType
  ownerServerId: string
  checkpointNonce: string
  checkpointData?: Record<string, unknown> | undefined
}

export class RuntimeCheckpointCoordinator {
  constructor(
    private repo: CheckpointRuntimeRepository,
    private audit: ContinuityAuditRepository,
    private eventBus: ContinuityRuntimeEventBus,
  ) {}

  async createCheckpoint(params: CreateCheckpointServiceParams): Promise<AtcCheckpointRuntime> {
    const record = await this.repo.create({
      checkpointType: params.checkpointType,
      ownerServerId: params.ownerServerId,
      checkpointNonce: params.checkpointNonce,
      checkpointData: params.checkpointData,
    })
    await this.audit.append({
      eventType: 'checkpoint_created',
      continuityId: record.checkpointId,
      ownerServerId: record.ownerServerId,
      auditData: { checkpointType: record.checkpointType },
    })
    this.eventBus.emit('atc:continuity:checkpoint:created', { checkpointId: record.checkpointId }).catch(() => undefined)
    return record
  }

  async commitCheckpoint(id: string): Promise<AtcCheckpointRuntime> {
    const record = await this.repo.updateStatus(id, 'committed', new Date())
    await this.audit.append({
      eventType: 'checkpoint_committed',
      continuityId: record.checkpointId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:continuity:checkpoint:committed', { checkpointId: record.checkpointId }).catch(() => undefined)
    return record
  }

  async rollbackCheckpoint(id: string): Promise<AtcCheckpointRuntime> {
    const record = await this.repo.updateStatus(id, 'rolled_back')
    await this.audit.append({
      eventType: 'checkpoint_rolled_back',
      continuityId: record.checkpointId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:continuity:checkpoint:rolled_back', { checkpointId: record.checkpointId }).catch(() => undefined)
    return record
  }

  async expireCheckpoint(id: string): Promise<AtcCheckpointRuntime> {
    const record = await this.repo.updateStatus(id, 'expired')
    await this.audit.append({
      eventType: 'checkpoint_expired',
      continuityId: record.checkpointId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:continuity:checkpoint:expired', { checkpointId: record.checkpointId }).catch(() => undefined)
    return record
  }

  async getCheckpoint(id: string): Promise<AtcCheckpointRuntime | null> {
    return this.repo.findById(id)
  }
}
