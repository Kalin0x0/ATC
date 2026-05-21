import type { RegionalConsistencyRepository, AtcRegionalConsistency, CreateConsistencyCheckParams } from './regional-consistency.repository.js'
import type { FederationAuditRepository } from './federation-audit.repository.js'
import type { FederationRuntimeEventBus } from './federation-recovery.service.js'

export class RegionalConsistencyService {
  constructor(
    private checkRepo: RegionalConsistencyRepository,
    private auditRepo: FederationAuditRepository,
    private eventBus: FederationRuntimeEventBus,
  ) {}

  async startCheck(params: CreateConsistencyCheckParams): Promise<AtcRegionalConsistency> {
    const check = await this.checkRepo.create(params)
    await this.auditRepo.append({ regionId: check.regionId, eventType: 'consistency_check_started', auditData: { checkId: check.checkId } })
    this.eventBus.emit('atc:federation:consistency:started', { checkId: check.checkId, regionId: check.regionId }).catch(() => undefined)
    return check
  }

  async completeCheck(id: string): Promise<AtcRegionalConsistency> {
    const check = await this.checkRepo.updateStatus(id, 'passed', new Date())
    await this.auditRepo.append({ regionId: check.regionId, eventType: 'consistency_check_passed', auditData: { checkId: check.checkId } })
    this.eventBus.emit('atc:federation:consistency:passed', { checkId: check.checkId, regionId: check.regionId }).catch(() => undefined)
    return check
  }

  async failCheck(id: string): Promise<AtcRegionalConsistency> {
    const check = await this.checkRepo.updateStatus(id, 'failed', new Date())
    this.eventBus.emit('atc:federation:consistency:failed', { checkId: check.checkId, regionId: check.regionId }).catch(() => undefined)
    return check
  }

  async getCheck(id: string): Promise<AtcRegionalConsistency | null> {
    return this.checkRepo.findById(id)
  }
}
