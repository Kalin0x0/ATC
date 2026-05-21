import type { EconomyRegulationRepository, AtcEconomyRegulation, CreateRegulationParams } from './economy-regulation.repository.js'
import type { EconomyAuditRepository } from './economy-audit.repository.js'
import type { EconomyRegulationEventBus } from './economic-recovery.service.js'

export class EconomyRegulationService {
  constructor(
    private regulationRepo: EconomyRegulationRepository,
    private auditRepo: EconomyAuditRepository,
    private eventBus: EconomyRegulationEventBus,
  ) {}

  async createRegulation(params: CreateRegulationParams): Promise<AtcEconomyRegulation> {
    const regulation = await this.regulationRepo.create(params)
    await this.auditRepo.append({
      eventType: 'regulation_created',
      regionId: regulation.regionId ?? undefined,
      ownerServerId: regulation.ownerServerId,
      auditData: { regulationId: regulation.regulationId, regulationType: regulation.regulationType },
    })
    this.eventBus.emit('atc:economy:regulation:created', { regulation }).catch(() => undefined)
    return regulation
  }

  async suspendRegulation(id: string): Promise<AtcEconomyRegulation> {
    const regulation = await this.regulationRepo.updateStatus(id, 'suspended')
    await this.auditRepo.append({
      eventType: 'regulation_suspended',
      regionId: regulation.regionId ?? undefined,
      ownerServerId: regulation.ownerServerId,
      auditData: { regulationId: regulation.regulationId },
    })
    this.eventBus.emit('atc:economy:regulation:suspended', { regulation }).catch(() => undefined)
    return regulation
  }

  async getRegulation(id: string): Promise<AtcEconomyRegulation | null> {
    return this.regulationRepo.findById(id)
  }

  async listActiveRegulations(ownerServerId?: string): Promise<AtcEconomyRegulation[]> {
    return this.regulationRepo.listActive(ownerServerId)
  }
}
