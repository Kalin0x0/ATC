import type { RuntimeLockdownRepository } from './runtime-lockdown.repository.js'
import type { ProductionIntegrityRepository } from './production-integrity.repository.js'
import type { RuntimeSealRepository } from './runtime-seal.repository.js'
import type { FinalizationRuntimeRepository } from './finalization-runtime.repository.js'
import type { DeterministicClosureRepository } from './deterministic-closure.repository.js'
import type { LockdownAuditRepository } from './lockdown-audit.repository.js'

export interface RuntimeLockdownEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export interface LockdownCleanupResult {
  lockdowns: number
  integrityChecks: number
  seals: number
  finalizations: number
  closures: number
}

export class LockdownRecoveryService {
  constructor(
    private lockdownRepo: RuntimeLockdownRepository,
    private integrityRepo: ProductionIntegrityRepository,
    private sealRepo: RuntimeSealRepository,
    private finalizationRepo: FinalizationRuntimeRepository,
    private closureRepo: DeterministicClosureRepository,
    private auditRepo: LockdownAuditRepository,
    private eventBus: RuntimeLockdownEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<LockdownCleanupResult> {
    const [lockdowns, integrityChecks, seals, finalizations, closures] = await Promise.all([
      this.lockdownRepo.cleanupStale(thresholdMs),
      this.integrityRepo.cleanupStale(thresholdMs),
      this.sealRepo.cleanupStale(thresholdMs),
      this.finalizationRepo.cleanupStale(thresholdMs),
      this.closureRepo.cleanupStale(thresholdMs),
    ])

    await this.auditRepo.append({
      eventType: 'stale_cleanup',
      auditData: { lockdowns, integrityChecks, seals, finalizations, closures, thresholdMs },
    })

    this.eventBus.emit('atc:lockdown:stale:cleaned', {
      lockdowns,
      integrityChecks,
      seals,
      finalizations,
      closures,
    }).catch(() => undefined)

    return { lockdowns, integrityChecks, seals, finalizations, closures }
  }
}
