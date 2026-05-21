import type {
  RuntimeImmutabilityRepository,
  AtcRuntimeImmutability,
  CreateImmutabilityParams,
} from './runtime-immutability.repository.js'
import type { CoreClosureAuditRepository } from './core-closure-audit.repository.js'
import type { CoreClosureEventBus } from './core-closure.service.js'

export class ProductionImmutabilityService {
  constructor(
    private readonly repo: RuntimeImmutabilityRepository,
    private readonly audit: CoreClosureAuditRepository,
    private readonly bus: CoreClosureEventBus
  ) {}

  async createImmutability(params: CreateImmutabilityParams): Promise<AtcRuntimeImmutability> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'runtime_immutability.created', { immutabilityId: record.immutabilityId })
    this.bus.emit('runtime_immutability.created', { immutabilityId: record.immutabilityId }).catch(() => undefined)
    return record
  }

  async activateImmutability(id: string): Promise<AtcRuntimeImmutability> {
    const record = await this.repo.updateStatus(id, 'active')
    this.bus.emit('runtime_immutability.activated', { immutabilityId: record.immutabilityId }).catch(() => undefined)
    return record
  }

  async freezeImmutability(id: string): Promise<AtcRuntimeImmutability> {
    const record = await this.repo.updateStatus(id, 'frozen', new Date())
    await this.audit.append(record.id, 'runtime_frozen', { immutabilityId: record.immutabilityId })
    this.bus.emit('runtime_frozen', { immutabilityId: record.immutabilityId }).catch(() => undefined)
    return record
  }

  async violateImmutability(id: string): Promise<AtcRuntimeImmutability> {
    const record = await this.repo.updateStatus(id, 'violated')
    this.bus.emit('runtime_immutability.violated', { immutabilityId: record.immutabilityId }).catch(() => undefined)
    return record
  }

  async getImmutability(id: string): Promise<AtcRuntimeImmutability | null> {
    return this.repo.findById(id)
  }
}
