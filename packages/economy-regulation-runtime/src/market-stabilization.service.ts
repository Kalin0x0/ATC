import type { MarketStabilizationRepository, AtcMarketStabilization, CreateStabilizationParams } from './market-stabilization.repository.js'
import type { EconomyAuditRepository } from './economy-audit.repository.js'
import type { EconomyRegulationEventBus } from './economic-recovery.service.js'

export class MarketStabilizationService {
  constructor(
    private stabilizationRepo: MarketStabilizationRepository,
    private auditRepo: EconomyAuditRepository,
    private eventBus: EconomyRegulationEventBus,
  ) {}

  async startStabilization(params: CreateStabilizationParams): Promise<AtcMarketStabilization> {
    const stabilization = await this.stabilizationRepo.create(params)
    await this.auditRepo.append({
      eventType: 'stabilization_started',
      regionId: stabilization.regionId ?? undefined,
      ownerServerId: stabilization.ownerServerId,
      auditData: { stabilizationId: stabilization.stabilizationId, marketType: stabilization.marketType },
    })
    this.eventBus.emit('atc:economy:market:stabilization_started', { stabilization }).catch(() => undefined)
    return stabilization
  }

  async completeStabilization(id: string): Promise<AtcMarketStabilization> {
    const stabilization = await this.stabilizationRepo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({
      eventType: 'stabilization_completed',
      regionId: stabilization.regionId ?? undefined,
      ownerServerId: stabilization.ownerServerId,
      auditData: { stabilizationId: stabilization.stabilizationId },
    })
    this.eventBus.emit('atc:economy:market:stabilized', { stabilization }).catch(() => undefined)
    return stabilization
  }

  async failStabilization(id: string): Promise<AtcMarketStabilization> {
    const stabilization = await this.stabilizationRepo.updateStatus(id, 'failed')
    this.eventBus.emit('atc:economy:market:stabilization_failed', { stabilization }).catch(() => undefined)
    return stabilization
  }

  async getStabilization(id: string): Promise<AtcMarketStabilization | null> {
    return this.stabilizationRepo.findById(id)
  }
}
