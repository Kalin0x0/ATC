import type {
  EnterpriseReadinessRepository,
  AtcEnterpriseReadiness,
  CreateEnterpriseReadinessParams,
} from './enterprise-readiness.repository.js'
import type { EnterpriseAuditRepository } from './enterprise-audit.repository.js'

export interface EnterpriseReadinessEventBus {
  emit(event: string, data: Record<string, unknown>): Promise<void>
}

export class EnterpriseReadinessService {
  constructor(
    private readonly repo: EnterpriseReadinessRepository,
    private readonly audit: EnterpriseAuditRepository,
    private readonly bus: EnterpriseReadinessEventBus
  ) {}

  async initiateReadiness(params: CreateEnterpriseReadinessParams): Promise<AtcEnterpriseReadiness> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'enterprise_readiness.initiated', { readinessId: record.readinessId })
    this.bus.emit('enterprise_readiness.initiated', { readinessId: record.readinessId }).catch(() => undefined)
    return record
  }

  async beginAssessment(id: string): Promise<AtcEnterpriseReadiness> {
    const record = await this.repo.updateStatus(id, 'assessing')
    this.bus.emit('enterprise_readiness.assessing', { readinessId: record.readinessId }).catch(() => undefined)
    return record
  }

  async confirmReadiness(id: string): Promise<AtcEnterpriseReadiness> {
    const record = await this.repo.updateStatus(id, 'ready', new Date())
    await this.audit.append(record.id, 'production_readiness_confirmed', { readinessId: record.readinessId })
    this.bus.emit('production_readiness_confirmed', { readinessId: record.readinessId }).catch(() => undefined)
    this.bus.emit('final_enterprise_validation_completed', { readinessId: record.readinessId }).catch(() => undefined)
    return record
  }

  async rejectReadiness(id: string): Promise<AtcEnterpriseReadiness> {
    const record = await this.repo.updateStatus(id, 'not_ready')
    this.bus.emit('enterprise_readiness.not_ready', { readinessId: record.readinessId }).catch(() => undefined)
    return record
  }

  async getReadiness(id: string): Promise<AtcEnterpriseReadiness | null> {
    return this.repo.findById(id)
  }
}
