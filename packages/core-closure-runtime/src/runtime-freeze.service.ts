import type {
  ProductionFreezeRepository,
  AtcProductionFreeze,
  InitiateFreezeParams,
} from './production-freeze.repository.js'
import type { CoreClosureAuditRepository } from './core-closure-audit.repository.js'
import type { CoreClosureEventBus } from './core-closure.service.js'

export class RuntimeFreezeCoordinator {
  constructor(
    private readonly repo: ProductionFreezeRepository,
    private readonly audit: CoreClosureAuditRepository,
    private readonly bus: CoreClosureEventBus
  ) {}

  async initiateFreeze(params: InitiateFreezeParams): Promise<AtcProductionFreeze> {
    const record = await this.repo.upsert(params)
    await this.audit.append(record.id, 'runtime_frozen', { freezeId: record.freezeId })
    this.bus.emit('runtime_frozen', { freezeId: record.freezeId }).catch(() => undefined)
    return record
  }

  async degradeFreeze(freezeId: string): Promise<AtcProductionFreeze> {
    const record = await this.repo.updateStatus(freezeId, 'degraded')
    this.bus.emit('production_freeze.degraded', { freezeId: record.freezeId }).catch(() => undefined)
    return record
  }

  async recoverFreeze(freezeId: string): Promise<AtcProductionFreeze> {
    const record = await this.repo.updateStatus(freezeId, 'recovering')
    this.bus.emit('production_freeze.recovering', { freezeId: record.freezeId }).catch(() => undefined)
    return record
  }

  async getFreeze(freezeId: string): Promise<AtcProductionFreeze | null> {
    return this.repo.findByFreezeId(freezeId)
  }
}
