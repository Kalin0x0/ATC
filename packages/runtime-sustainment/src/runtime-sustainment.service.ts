import type {
  RuntimeSustainmentRepository,
  AtcRuntimeSustainment,
  CreateSustainmentParams,
} from './runtime-sustainment.repository.js'
import type { SustainmentAuditRepository } from './sustainment-audit.repository.js'

export interface RuntimeSustainmentEventBus {
  emit(event: string, data: Record<string, unknown>): Promise<void>
}

export class RuntimeSustainmentService {
  constructor(
    private readonly repo: RuntimeSustainmentRepository,
    private readonly audit: SustainmentAuditRepository,
    private readonly bus: RuntimeSustainmentEventBus
  ) {}

  async initiateSustainment(params: CreateSustainmentParams): Promise<AtcRuntimeSustainment> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'sustainment_initiated', { sustainmentId: record.sustainmentId })
    this.bus.emit('sustainment.initiated', { sustainmentId: record.sustainmentId }).catch(() => undefined)
    return record
  }

  async startSustainment(id: string): Promise<AtcRuntimeSustainment> {
    const record = await this.repo.updateStatus(id, 'active', new Date())
    await this.audit.append(record.id, 'sustainment_started', { sustainmentId: record.sustainmentId })
    this.bus.emit('sustainment_started', { sustainmentId: record.sustainmentId }).catch(() => undefined)
    return record
  }

  async maintainSustainment(id: string): Promise<AtcRuntimeSustainment> {
    const record = await this.repo.updateStatus(id, 'maintaining')
    await this.audit.append(record.id, 'sustainment_maintaining', { sustainmentId: record.sustainmentId })
    this.bus.emit('sustainment.maintaining', { sustainmentId: record.sustainmentId }).catch(() => undefined)
    return record
  }

  async completeSustainment(id: string): Promise<AtcRuntimeSustainment> {
    const record = await this.repo.updateStatus(id, 'completed')
    await this.audit.append(record.id, 'sustainment_completed', { sustainmentId: record.sustainmentId })
    this.bus.emit('permanent_runtime_stability_established', { sustainmentId: record.sustainmentId }).catch(() => undefined)
    return record
  }

  async failSustainment(id: string): Promise<AtcRuntimeSustainment> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.audit.append(record.id, 'sustainment_failed', { sustainmentId: record.sustainmentId })
    this.bus.emit('sustainment.failed', { sustainmentId: record.sustainmentId }).catch(() => undefined)
    return record
  }

  async getSustainment(id: string): Promise<AtcRuntimeSustainment | null> {
    return this.repo.findById(id)
  }
}
