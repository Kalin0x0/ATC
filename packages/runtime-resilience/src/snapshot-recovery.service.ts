import type { RecoverySnapshotRepository, AtcRecoverySnapshot, CreateRecoverySnapshotParams } from './recovery-snapshot.repository.js'
import type { FailoverAuditRepository } from './failover-audit.repository.js'
import type { RuntimeResilienceEventBus } from './runtime-recovery-coordinator.js'

export class SnapshotRecoveryService {
  constructor(
    private snapshotRepo: RecoverySnapshotRepository,
    private auditRepo: FailoverAuditRepository,
    private eventBus: RuntimeResilienceEventBus,
  ) {}

  async createSnapshot(params: CreateRecoverySnapshotParams): Promise<AtcRecoverySnapshot> {
    const snapshot = await this.snapshotRepo.create(params)
    this.eventBus.emit('atc:resilience:snapshot:created', { id: snapshot.id, entityId: snapshot.entityId }).catch(() => undefined)
    return snapshot
  }

  async restoreSnapshot(id: string): Promise<AtcRecoverySnapshot> {
    const snapshot = await this.snapshotRepo.markApplied(id)
    await this.auditRepo.append({ eventType: 'snapshot_restored', auditData: { snapshotId: id, entityId: snapshot.entityId } })
    this.eventBus.emit('atc:resilience:snapshot:restored', { id, entityId: snapshot.entityId }).catch(() => undefined)
    return snapshot
  }

  async getSnapshot(id: string): Promise<AtcRecoverySnapshot | null> {
    return this.snapshotRepo.findById(id)
  }

  async listByEntity(entityId: string): Promise<AtcRecoverySnapshot[]> {
    return this.snapshotRepo.listByEntity(entityId)
  }

  async listUnapplied(ownerServerId?: string): Promise<AtcRecoverySnapshot[]> {
    return this.snapshotRepo.listUnapplied(ownerServerId)
  }
}
