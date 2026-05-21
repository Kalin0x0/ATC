import type {
  ProductionReadinessRepository,
  AtcProductionReadiness,
  InitiateReadinessParams,
} from './production-readiness.repository.js'
import type { EnterpriseAuditRepository } from './enterprise-audit.repository.js'
import type { EnterpriseReadinessEventBus } from './enterprise-readiness.service.js'

export class ProductionReadinessCoordinator {
  constructor(
    private readonly repo: ProductionReadinessRepository,
    private readonly audit: EnterpriseAuditRepository,
    private readonly bus: EnterpriseReadinessEventBus
  ) {}

  async initiateCheckpoint(params: InitiateReadinessParams): Promise<AtcProductionReadiness> {
    const record = await this.repo.upsert(params)
    await this.audit.append(record.id, 'production_readiness.initiated', { readinessCheckpointId: record.readinessCheckpointId })
    this.bus.emit('production_readiness.initiated', { readinessCheckpointId: record.readinessCheckpointId }).catch(() => undefined)
    return record
  }

  async beginConfirming(readinessCheckpointId: string): Promise<AtcProductionReadiness> {
    const record = await this.repo.updateStatus(readinessCheckpointId, 'confirming')
    this.bus.emit('production_readiness.confirming', { readinessCheckpointId: record.readinessCheckpointId }).catch(() => undefined)
    return record
  }

  async confirmCheckpoint(readinessCheckpointId: string): Promise<AtcProductionReadiness> {
    const record = await this.repo.updateStatus(readinessCheckpointId, 'confirmed', new Date())
    await this.audit.append(record.id, 'production_readiness_confirmed', { readinessCheckpointId: record.readinessCheckpointId })
    this.bus.emit('production_readiness_confirmed', { readinessCheckpointId: record.readinessCheckpointId }).catch(() => undefined)
    return record
  }

  async blockCheckpoint(readinessCheckpointId: string): Promise<AtcProductionReadiness> {
    const record = await this.repo.updateStatus(readinessCheckpointId, 'blocked')
    this.bus.emit('production_readiness.blocked', { readinessCheckpointId: record.readinessCheckpointId }).catch(() => undefined)
    return record
  }

  async getCheckpoint(readinessCheckpointId: string): Promise<AtcProductionReadiness | null> {
    return this.repo.findByCheckpointId(readinessCheckpointId)
  }
}
