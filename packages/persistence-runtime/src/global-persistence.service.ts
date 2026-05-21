import type { GlobalSnapshotRepository, AtcGlobalSnapshot, CreateSnapshotParams } from './global-snapshot.repository.js'
import type { PersistenceAuditRepository } from './persistence-audit.repository.js'
import type { PersistenceRuntimeEventBus } from './persistence-consistency.service.js'

export class GlobalPersistenceService {
  constructor(
    private snapshotRepo: GlobalSnapshotRepository,
    private auditRepo: PersistenceAuditRepository,
    private eventBus: PersistenceRuntimeEventBus,
  ) {}

  async createSnapshot(params: CreateSnapshotParams): Promise<AtcGlobalSnapshot> {
    const snapshot = await this.snapshotRepo.create(params)
    await this.auditRepo.append({ snapshotId: snapshot.snapshotId, eventType: 'snapshot_created' })
    this.eventBus.emit('atc:persistence:snapshot:created', { snapshotId: snapshot.snapshotId }).catch(() => undefined)
    return snapshot
  }

  async completeSnapshot(id: string): Promise<AtcGlobalSnapshot> {
    const snapshot = await this.snapshotRepo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({ snapshotId: snapshot.snapshotId, eventType: 'snapshot_completed' })
    this.eventBus.emit('atc:persistence:snapshot:completed', { snapshotId: snapshot.snapshotId }).catch(() => undefined)
    return snapshot
  }

  async failSnapshot(id: string): Promise<AtcGlobalSnapshot> {
    const snapshot = await this.snapshotRepo.updateStatus(id, 'failed')
    this.eventBus.emit('atc:persistence:snapshot:failed', { snapshotId: snapshot.snapshotId }).catch(() => undefined)
    return snapshot
  }

  async getSnapshot(id: string): Promise<AtcGlobalSnapshot | null> {
    return this.snapshotRepo.findById(id)
  }

  async listActiveSnapshots(ownerServerId?: string): Promise<AtcGlobalSnapshot[]> {
    return this.snapshotRepo.listActive(ownerServerId)
  }
}
