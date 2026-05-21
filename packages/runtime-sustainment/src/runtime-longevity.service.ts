import type {
  RuntimeLongevityRepository,
  AtcRuntimeLongevity,
  CreateLongevityParams,
} from './runtime-longevity.repository.js'
import type { SustainmentAuditRepository } from './sustainment-audit.repository.js'
import type { RuntimeSustainmentEventBus } from './runtime-sustainment.service.js'

export class RuntimeLongevityService {
  constructor(
    private readonly repo: RuntimeLongevityRepository,
    private readonly audit: SustainmentAuditRepository,
    private readonly bus: RuntimeSustainmentEventBus
  ) {}

  async createCheckpoint(params: CreateLongevityParams): Promise<AtcRuntimeLongevity> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'checkpoint_created', { longevityId: record.longevityId })
    this.bus.emit('longevity.checkpoint_created', { longevityId: record.longevityId }).catch(() => undefined)
    return record
  }

  async activateCheckpoint(id: string): Promise<AtcRuntimeLongevity> {
    const record = await this.repo.updateStatus(id, 'active')
    await this.audit.append(record.id, 'checkpoint_activated', { longevityId: record.longevityId })
    this.bus.emit('longevity.checkpoint_activated', { longevityId: record.longevityId }).catch(() => undefined)
    return record
  }

  async archiveCheckpoint(id: string): Promise<AtcRuntimeLongevity> {
    const record = await this.repo.updateStatus(id, 'archived', new Date())
    await this.audit.append(record.id, 'checkpoint_archived', { longevityId: record.longevityId })
    this.bus.emit('permanent_runtime_stability_established', { longevityId: record.longevityId }).catch(() => undefined)
    return record
  }

  async expireCheckpoint(id: string): Promise<AtcRuntimeLongevity> {
    const record = await this.repo.updateStatus(id, 'expired')
    await this.audit.append(record.id, 'checkpoint_expired', { longevityId: record.longevityId })
    this.bus.emit('longevity.checkpoint_expired', { longevityId: record.longevityId }).catch(() => undefined)
    return record
  }

  async getCheckpoint(id: string): Promise<AtcRuntimeLongevity | null> {
    return this.repo.findById(id)
  }
}
