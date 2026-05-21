import type { WorldIntegrityRepository } from './world-integrity.repository.js'
import type { DistributedLockRepository } from './distributed-lock.repository.js'
import type { IntegrityValidationRepository } from './integrity-validation.repository.js'
import type { WorldReconciliationRepository } from './world-reconciliation.repository.js'
import type { IntegrityAuditRepository } from './integrity-audit.repository.js'

export interface WorldIntegrityEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export interface IntegrityCleanupResult {
  integrities: number
  locks: number
  validations: number
  reconciliations: number
}

export class IntegrityRecoveryService {
  constructor(
    private integrityRepo: WorldIntegrityRepository,
    private lockRepo: DistributedLockRepository,
    private validationRepo: IntegrityValidationRepository,
    private reconciliationRepo: WorldReconciliationRepository,
    private auditRepo: IntegrityAuditRepository,
    private eventBus: WorldIntegrityEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<IntegrityCleanupResult> {
    const [integrities, locks, validations, reconciliations] = await Promise.all([
      this.integrityRepo.cleanupStale(thresholdMs),
      this.lockRepo.cleanupStale(thresholdMs),
      this.validationRepo.cleanupStale(thresholdMs),
      this.reconciliationRepo.cleanupStale(thresholdMs),
    ])

    await this.auditRepo.append({
      eventType: 'stale_cleanup',
      auditData: { integrities, locks, validations, reconciliations, thresholdMs },
    })

    this.eventBus.emit('atc:world-integrity:stale:cleaned', {
      integrities,
      locks,
      validations,
      reconciliations,
    }).catch(() => undefined)

    return { integrities, locks, validations, reconciliations }
  }
}
