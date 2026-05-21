import type { RuntimeFailoverRepository } from './runtime-failover.repository.js'
import type { RecoveryOperationRepository } from './recovery-operation.repository.js'
import type { RuntimeResilienceRepository, AtcResilienceRecord } from './runtime-resilience.repository.js'
import type { FailoverAuditRepository } from './failover-audit.repository.js'
import type { RuntimeResilienceEventBus } from './runtime-recovery-coordinator.js'

export class DistributedHealthRecoveryService {
  constructor(
    private failoverRepo: RuntimeFailoverRepository,
    private recoveryOpRepo: RecoveryOperationRepository,
    private resilienceRepo: RuntimeResilienceRepository,
    private auditRepo: FailoverAuditRepository,
    private eventBus: RuntimeResilienceEventBus,
  ) {}

  async repairStaleOwnership(ownerServerId: string): Promise<{ repaired: number }> {
    const active = await this.failoverRepo.listActive(ownerServerId)
    let repaired = 0
    for (const failover of active) {
      await this.failoverRepo.updateStatus(failover.id, 'rolled_back')
      repaired++
    }
    this.eventBus.emit('atc:resilience:ownership:repaired', { ownerServerId, repaired }).catch(() => undefined)
    return { repaired }
  }

  async cleanupStale(thresholdMs: number): Promise<{ failovers: number }> {
    const failovers = await this.failoverRepo.cleanupStale(thresholdMs)
    return { failovers }
  }

  async getClusterHealth(ownerServerId?: string): Promise<{ records: AtcResilienceRecord[]; overallScore: number }> {
    const records = await this.resilienceRepo.listAll(ownerServerId)
    const overallScore =
      records.length > 0
        ? Math.round(records.reduce((sum, r) => sum + r.healthScore, 0) / records.length)
        : 100
    return { records, overallScore }
  }
}
