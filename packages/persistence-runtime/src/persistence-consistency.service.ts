import type { GlobalSnapshotRepository } from './global-snapshot.repository.js'
import type { PersistenceRuntimeRepository } from './persistence-runtime.repository.js'
import type { LongtermRecoveryRepository } from './longterm-recovery.repository.js'
import type { PersistenceAuditRepository } from './persistence-audit.repository.js'

export interface PersistenceRuntimeEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export class PersistenceConsistencyService {
  constructor(
    private snapshotRepo: GlobalSnapshotRepository,
    private persistenceRepo: PersistenceRuntimeRepository,
    private recoveryRepo: LongtermRecoveryRepository,
    private auditRepo: PersistenceAuditRepository,
    private eventBus: PersistenceRuntimeEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<{ snapshots: number; states: number; recoveries: number }> {
    const [snapshots, states, recoveries] = await Promise.all([
      this.snapshotRepo.cleanupStale(thresholdMs),
      this.persistenceRepo.cleanupStale(thresholdMs),
      this.recoveryRepo.cleanupStale(thresholdMs),
    ])
    await this.auditRepo.append({ eventType: 'cleanup_completed', auditData: { snapshots, states, recoveries } })
    this.eventBus.emit('atc:persistence:cleanup:completed', { snapshots, states, recoveries }).catch(() => undefined)
    return { snapshots, states, recoveries }
  }
}
