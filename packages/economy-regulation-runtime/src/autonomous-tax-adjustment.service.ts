import type { TaxRuntimeRepository, AtcTaxRuntime, UpsertTaxParams } from './tax-runtime.repository.js'
import type { EconomyAuditRepository } from './economy-audit.repository.js'
import type { EconomyRegulationEventBus } from './economic-recovery.service.js'

export class AutonomousTaxAdjustmentService {
  constructor(
    private taxRepo: TaxRuntimeRepository,
    private auditRepo: EconomyAuditRepository,
    private eventBus: EconomyRegulationEventBus,
  ) {}

  async upsertTaxRate(params: UpsertTaxParams): Promise<AtcTaxRuntime> {
    const tax = await this.taxRepo.upsert(params)
    await this.auditRepo.append({
      eventType: 'tax_adjusted',
      regionId: tax.regionId,
      ownerServerId: tax.ownerServerId,
      auditData: { taxType: tax.taxType, rate: tax.rate },
    })
    this.eventBus.emit('atc:economy:tax:adjusted', { tax }).catch(() => undefined)
    return tax
  }

  async getTaxRate(regionId: string): Promise<AtcTaxRuntime | null> {
    return this.taxRepo.findByRegion(regionId)
  }

  async suspendTax(regionId: string): Promise<void> {
    await this.taxRepo.suspend(regionId)
    await this.auditRepo.append({
      eventType: 'tax_suspended',
      regionId,
      auditData: { regionId },
    })
    this.eventBus.emit('atc:economy:tax:suspended', { regionId }).catch(() => undefined)
  }
}
