import type { RuntimeFailoverRepository, AtcRuntimeFailover, CreateFailoverParams } from './runtime-failover.repository.js'
import type { FailoverAuditRepository } from './failover-audit.repository.js'
import type { RuntimeResilienceEventBus } from './runtime-recovery-coordinator.js'

export class FailoverOrchestrationService {
  constructor(
    private failoverRepo: RuntimeFailoverRepository,
    private auditRepo: FailoverAuditRepository,
    private eventBus: RuntimeResilienceEventBus,
  ) {}

  async initiateFailover(params: CreateFailoverParams): Promise<AtcRuntimeFailover> {
    const failover = await this.failoverRepo.create(params)
    await this.auditRepo.append({ failoverId: failover.failoverId, eventType: 'failover_initiated' })
    this.eventBus.emit('atc:resilience:failover:started', { failoverId: failover.failoverId }).catch(() => undefined)
    return failover
  }

  async completeFailover(id: string): Promise<AtcRuntimeFailover> {
    const failover = await this.failoverRepo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({ failoverId: failover.failoverId, eventType: 'failover_completed' })
    this.eventBus.emit('atc:resilience:failover:completed', { failoverId: failover.failoverId }).catch(() => undefined)
    return failover
  }

  async failFailover(id: string): Promise<AtcRuntimeFailover> {
    const failover = await this.failoverRepo.updateStatus(id, 'failed')
    await this.auditRepo.append({ failoverId: failover.failoverId, eventType: 'failover_failed' })
    this.eventBus.emit('atc:resilience:failover:failed', { failoverId: failover.failoverId }).catch(() => undefined)
    return failover
  }

  async getFailover(id: string): Promise<AtcRuntimeFailover | null> {
    return this.failoverRepo.findById(id)
  }

  async listActiveFailovers(sourceServerId?: string): Promise<AtcRuntimeFailover[]> {
    return this.failoverRepo.listActive(sourceServerId)
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    return this.failoverRepo.cleanupStale(thresholdMs)
  }
}
