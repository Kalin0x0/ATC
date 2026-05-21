import type { CoreClosureRepository } from './core-closure.repository.js'
import type { RuntimeImmutabilityRepository } from './runtime-immutability.repository.js'
import type { ProductionFreezeRepository } from './production-freeze.repository.js'
import type { DistributedClosureRepository } from './distributed-closure.repository.js'
import type { FinalValidationRepository } from './final-validation.repository.js'
import type { CoreClosureAuditRepository } from './core-closure-audit.repository.js'
import type { CoreClosureEventBus } from './core-closure.service.js'

export interface CoreClosureCleanupResult {
  closures: number
  immutabilities: number
  freezes: number
  closureNodes: number
  validations: number
}

export class FinalRecoveryCoordinator {
  constructor(
    private readonly closureRepo: CoreClosureRepository,
    private readonly immutabilityRepo: RuntimeImmutabilityRepository,
    private readonly freezeRepo: ProductionFreezeRepository,
    private readonly distributedClosureRepo: DistributedClosureRepository,
    private readonly validationRepo: FinalValidationRepository,
    private readonly audit: CoreClosureAuditRepository,
    private readonly bus: CoreClosureEventBus
  ) {}

  async cleanupStale(thresholdMs: number): Promise<CoreClosureCleanupResult> {
    const [closures, immutabilities, freezes, closureNodes, validations] = await Promise.all([
      this.closureRepo.cleanupStale(thresholdMs),
      this.immutabilityRepo.cleanupStale(thresholdMs),
      this.freezeRepo.cleanupStale(thresholdMs),
      this.distributedClosureRepo.cleanupStale(thresholdMs),
      this.validationRepo.cleanupStale(thresholdMs),
    ])
    this.bus.emit('core_closure.stale_cleaned', { closures, immutabilities, freezes, closureNodes, validations }).catch(() => undefined)
    return { closures, immutabilities, freezes, closureNodes, validations }
  }
}
