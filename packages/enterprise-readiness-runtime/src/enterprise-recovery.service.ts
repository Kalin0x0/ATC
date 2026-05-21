import type { EnterpriseReadinessRepository } from './enterprise-readiness.repository.js'
import type { DeterministicAuditRepository } from './deterministic-audit.repository.js'
import type { IntegrityVerificationRepository } from './integrity-verification.repository.js'
import type { ProductionReadinessRepository } from './production-readiness.repository.js'
import type { DistributedAuditRepository } from './distributed-audit.repository.js'
import type { EnterpriseAuditRepository } from './enterprise-audit.repository.js'
import type { EnterpriseReadinessEventBus } from './enterprise-readiness.service.js'

export interface EnterpriseCleanupResult {
  readinesses: number
  deterministicAudits: number
  integrityVerifications: number
  productionReadinesses: number
  distributedAudits: number
}

export class EnterpriseRecoveryService {
  constructor(
    private readonly readinessRepo: EnterpriseReadinessRepository,
    private readonly deterministicAuditRepo: DeterministicAuditRepository,
    private readonly integrityRepo: IntegrityVerificationRepository,
    private readonly productionReadinessRepo: ProductionReadinessRepository,
    private readonly distributedAuditRepo: DistributedAuditRepository,
    private readonly audit: EnterpriseAuditRepository,
    private readonly bus: EnterpriseReadinessEventBus
  ) {}

  async cleanupStale(thresholdMs: number): Promise<EnterpriseCleanupResult> {
    const [readinesses, deterministicAudits, integrityVerifications, productionReadinesses, distributedAudits] = await Promise.all([
      this.readinessRepo.cleanupStale(thresholdMs),
      this.deterministicAuditRepo.cleanupStale(thresholdMs),
      this.integrityRepo.cleanupStale(thresholdMs),
      this.productionReadinessRepo.cleanupStale(thresholdMs),
      this.distributedAuditRepo.cleanupStale(thresholdMs),
    ])
    this.bus.emit('enterprise.stale_cleaned', { readinesses, deterministicAudits, integrityVerifications, productionReadinesses, distributedAudits }).catch(() => undefined)
    return { readinesses, deterministicAudits, integrityVerifications, productionReadinesses, distributedAudits }
  }
}
