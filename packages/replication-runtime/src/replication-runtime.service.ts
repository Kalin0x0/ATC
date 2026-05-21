import type { RuntimeSnapshotRepository } from './runtime-snapshot.repository.js'
import type {
  AtcRuntimeSnapshot,
  CreateSnapshotParams,
} from './runtime-snapshot.repository.js'
import type { ReplicationAuditRepository } from './replication-audit.repository.js'
import type { ReplicationEventBus } from './spatial-ownership.service.js'

export class ReplicationRuntimeService {
  constructor(
    private readonly snapshotRepo: RuntimeSnapshotRepository,
    private readonly auditRepo: ReplicationAuditRepository,
    private readonly eventBus?: ReplicationEventBus | undefined
  ) {}

  async createSnapshot(params: CreateSnapshotParams): Promise<AtcRuntimeSnapshot> {
    const snapshot = await this.snapshotRepo.create(params)
    await this.auditRepo.record(params.entityId, 'snapshot.created', params.ownerServerId, {
      snapshotId: snapshot.snapshotId,
      snapshotType: params.snapshotType,
      sequenceNumber: params.sequenceNumber,
    })
    this.eventBus
      ?.emit('atc:replication:snapshot:created', {
        entityId: params.entityId,
        snapshotId: snapshot.snapshotId,
        snapshotType: params.snapshotType,
        sequenceNumber: params.sequenceNumber,
        ownerServerId: params.ownerServerId,
      })
      .catch(() => undefined)
    return snapshot
  }

  async replaySnapshot(snapshotId: string): Promise<AtcRuntimeSnapshot> {
    const snapshot = await this.snapshotRepo.markReplayed(snapshotId)
    await this.auditRepo.record(snapshot.entityId, 'snapshot.replayed', snapshot.ownerServerId, {
      snapshotId,
      sequenceNumber: snapshot.sequenceNumber,
    })
    this.eventBus
      ?.emit('atc:replication:snapshot:replayed', {
        entityId: snapshot.entityId,
        snapshotId,
        sequenceNumber: snapshot.sequenceNumber,
        ownerServerId: snapshot.ownerServerId,
      })
      .catch(() => undefined)
    return snapshot
  }

  async listSnapshotsByEntity(entityId: string): Promise<AtcRuntimeSnapshot[]> {
    return this.snapshotRepo.listByEntityId(entityId)
  }
}
