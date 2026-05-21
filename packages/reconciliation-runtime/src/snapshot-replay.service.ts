import type { SnapshotReplayRepository } from './snapshot-replay.repository.js'
import type { AtcSnapshotReplay } from './snapshot-replay.repository.js'
import type { RuntimeConsistencyAuditRepository } from './runtime-consistency-audit.repository.js'
import type { ReconciliationEventBus } from './runtime-migration.service.js'

export class SnapshotReplayService {
  constructor(
    private readonly replayRepo: SnapshotReplayRepository,
    private readonly auditRepo: RuntimeConsistencyAuditRepository,
    private readonly eventBus?: ReconciliationEventBus | undefined
  ) {}

  async replayCheckpoint(entityId: string, snapshotId: string): Promise<AtcSnapshotReplay> {
    const replay = await this.replayRepo.create({ entityId, snapshotId })
    const completed = await this.replayRepo.complete(replay.replayId)

    await this.auditRepo.record(
      completed.replayId,
      'snapshot:replayed',
      undefined,
      { entityId, snapshotId }
    )

    this.eventBus
      ?.emit('atc:reconciliation:snapshot:replayed', {
        replayId: completed.replayId,
        entityId,
        snapshotId,
      })
      .catch(() => undefined)

    return completed
  }

  async listPendingReplays(): Promise<AtcSnapshotReplay[]> {
    return this.replayRepo.listPending()
  }
}
