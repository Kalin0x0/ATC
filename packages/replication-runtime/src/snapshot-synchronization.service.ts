import type { RuntimeSnapshotRepository } from './runtime-snapshot.repository.js'
import type { AtcRuntimeSnapshot } from './runtime-snapshot.repository.js'

export class SnapshotSynchronizationService {
  constructor(private readonly snapshotRepo: RuntimeSnapshotRepository) {}

  async synchronizeSnapshot(entityId: string): Promise<AtcRuntimeSnapshot | null> {
    const snapshots = await this.snapshotRepo.listByEntityId(entityId)
    const pending = snapshots.filter((s) => !s.isReplayed)

    // Find the latest non-replayed snapshot by highest sequence number
    const latest = pending.reduce<AtcRuntimeSnapshot | null>((best, s) => {
      if (!best) return s
      return s.sequenceNumber > best.sequenceNumber ? s : best
    }, null)

    if (!latest) return null

    return this.snapshotRepo.markReplayed(latest.snapshotId)
  }

  async listPendingSnapshots(entityId: string): Promise<AtcRuntimeSnapshot[]> {
    const snapshots = await this.snapshotRepo.listByEntityId(entityId)
    return snapshots.filter((s) => !s.isReplayed)
  }
}
