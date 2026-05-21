import type {
  CoreClosureRepository,
  AtcCoreClosure,
  CreateCoreClosureParams,
} from './core-closure.repository.js'
import type { CoreClosureAuditRepository } from './core-closure-audit.repository.js'

export interface CoreClosureEventBus {
  emit(event: string, data: Record<string, unknown>): Promise<void>
}

export class CoreClosureService {
  constructor(
    private readonly repo: CoreClosureRepository,
    private readonly audit: CoreClosureAuditRepository,
    private readonly bus: CoreClosureEventBus
  ) {}

  async initiateClosure(params: CreateCoreClosureParams): Promise<AtcCoreClosure> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'core_closure.initiated', { closureId: record.closureId })
    this.bus.emit('core_closure.initiated', { closureId: record.closureId }).catch(() => undefined)
    return record
  }

  async startClosure(id: string): Promise<AtcCoreClosure> {
    const record = await this.repo.updateStatus(id, 'active')
    await this.audit.append(record.id, 'core_closure_started', { closureId: record.closureId })
    this.bus.emit('core_closure_started', { closureId: record.closureId }).catch(() => undefined)
    return record
  }

  async sealClosure(id: string): Promise<AtcCoreClosure> {
    const record = await this.repo.updateStatus(id, 'sealed', new Date())
    await this.audit.append(record.id, 'immutable_production_seal_applied', { closureId: record.closureId })
    this.bus.emit('immutable_production_seal_applied', { closureId: record.closureId }).catch(() => undefined)
    return record
  }

  async failClosure(id: string): Promise<AtcCoreClosure> {
    const record = await this.repo.updateStatus(id, 'failed')
    this.bus.emit('core_closure.failed', { closureId: record.closureId }).catch(() => undefined)
    return record
  }

  async getClosure(id: string): Promise<AtcCoreClosure | null> {
    return this.repo.findById(id)
  }
}
