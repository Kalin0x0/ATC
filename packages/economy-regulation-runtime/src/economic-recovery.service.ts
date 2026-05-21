import type { EconomyRegulationRepository } from './economy-regulation.repository.js'
import type { ResourceBalancingRepository } from './resource-balancing.repository.js'
import type { MarketStabilizationRepository } from './market-stabilization.repository.js'
import type { EconomyAuditRepository } from './economy-audit.repository.js'

export interface EconomyRegulationEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export class EconomicRecoveryService {
  constructor(
    private regulationRepo: EconomyRegulationRepository,
    private balancingRepo: ResourceBalancingRepository,
    private stabilizationRepo: MarketStabilizationRepository,
    private auditRepo: EconomyAuditRepository,
    private eventBus: EconomyRegulationEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<{ regulations: number; balancings: number; stabilizations: number }> {
    const [regulations, balancings, stabilizations] = await Promise.all([
      this.regulationRepo.cleanupStale(thresholdMs),
      this.balancingRepo.cleanupStale(thresholdMs),
      this.stabilizationRepo.cleanupStale(thresholdMs),
    ])
    await this.auditRepo.append({ eventType: 'cleanup_completed', auditData: { regulations, balancings, stabilizations } })
    this.eventBus.emit('atc:economy:cleanup:completed', { regulations, balancings, stabilizations }).catch(() => undefined)
    return { regulations, balancings, stabilizations }
  }
}
