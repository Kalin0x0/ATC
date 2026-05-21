import type { ResourceBalancingRepository, AtcResourceBalancing, CreateBalancingParams } from './resource-balancing.repository.js'
import type { EconomyAuditRepository } from './economy-audit.repository.js'
import type { EconomyRegulationEventBus } from './economic-recovery.service.js'

export class ResourceBalancingService {
  constructor(
    private balancingRepo: ResourceBalancingRepository,
    private auditRepo: EconomyAuditRepository,
    private eventBus: EconomyRegulationEventBus,
  ) {}

  async startBalancing(params: CreateBalancingParams): Promise<AtcResourceBalancing> {
    const balancing = await this.balancingRepo.create(params)
    await this.auditRepo.append({
      eventType: 'balancing_started',
      regionId: balancing.targetRegionId ?? undefined,
      ownerServerId: balancing.ownerServerId,
      auditData: { balancingId: balancing.balancingId, resourceType: balancing.resourceType },
    })
    this.eventBus.emit('atc:economy:balancing:started', { balancing }).catch(() => undefined)
    return balancing
  }

  async completeBalancing(id: string): Promise<AtcResourceBalancing> {
    const balancing = await this.balancingRepo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({
      eventType: 'balancing_completed',
      regionId: balancing.targetRegionId ?? undefined,
      ownerServerId: balancing.ownerServerId,
      auditData: { balancingId: balancing.balancingId },
    })
    this.eventBus.emit('atc:economy:balancing:completed', { balancing }).catch(() => undefined)
    return balancing
  }

  async failBalancing(id: string): Promise<AtcResourceBalancing> {
    const balancing = await this.balancingRepo.updateStatus(id, 'failed')
    this.eventBus.emit('atc:economy:balancing:failed', { balancing }).catch(() => undefined)
    return balancing
  }

  async getBalancing(id: string): Promise<AtcResourceBalancing | null> {
    return this.balancingRepo.findById(id)
  }
}
