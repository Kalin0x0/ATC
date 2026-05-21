import type {
  DistributedSustainmentRepository,
  AtcDistributedSustainment,
  RegisterNodeParams,
} from './distributed-sustainment.repository.js'
import type { SustainmentAuditRepository } from './sustainment-audit.repository.js'
import type { RuntimeSustainmentEventBus } from './runtime-sustainment.service.js'

export class DistributedSustainmentService {
  constructor(
    private readonly repo: DistributedSustainmentRepository,
    private readonly audit: SustainmentAuditRepository,
    private readonly bus: RuntimeSustainmentEventBus
  ) {}

  async registerNode(params: RegisterNodeParams): Promise<AtcDistributedSustainment> {
    const record = await this.repo.upsert(params)
    await this.audit.append(record.id, 'node_registered', { sustainmentNodeId: record.sustainmentNodeId })
    this.bus.emit('node.registered', { sustainmentNodeId: record.sustainmentNodeId }).catch(() => undefined)
    return record
  }

  async degradeNode(sustainmentNodeId: string): Promise<AtcDistributedSustainment> {
    const record = await this.repo.updateStatus(sustainmentNodeId, 'degraded')
    await this.audit.append(record.id, 'node_degraded', { sustainmentNodeId: record.sustainmentNodeId })
    this.bus.emit('node.degraded', { sustainmentNodeId: record.sustainmentNodeId }).catch(() => undefined)
    return record
  }

  async recoverNode(sustainmentNodeId: string): Promise<AtcDistributedSustainment> {
    const record = await this.repo.updateStatus(sustainmentNodeId, 'recovering')
    await this.audit.append(record.id, 'node_recovering', { sustainmentNodeId: record.sustainmentNodeId })
    this.bus.emit('node.recovering', { sustainmentNodeId: record.sustainmentNodeId }).catch(() => undefined)
    return record
  }

  async failNode(sustainmentNodeId: string): Promise<AtcDistributedSustainment> {
    const record = await this.repo.updateStatus(sustainmentNodeId, 'failed')
    await this.audit.append(record.id, 'node_failed', { sustainmentNodeId: record.sustainmentNodeId })
    this.bus.emit('node.failed', { sustainmentNodeId: record.sustainmentNodeId }).catch(() => undefined)
    return record
  }

  async getNode(sustainmentNodeId: string): Promise<AtcDistributedSustainment | null> {
    return this.repo.findByNodeId(sustainmentNodeId)
  }
}
