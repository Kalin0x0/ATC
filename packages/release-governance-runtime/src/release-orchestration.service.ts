import type {
  ReleaseOrchestrationRepository,
  AtcReleaseOrchestration,
  InitiateOrchestrationParams,
} from './release-orchestration.repository.js'
import type { ReleaseAuditRepository } from './release-audit.repository.js'
import type { ReleaseGovernanceEventBus } from './release-governance.service.js'

export class DistributedReleaseOrchestrator {
  constructor(
    private readonly repo: ReleaseOrchestrationRepository,
    private readonly audit: ReleaseAuditRepository,
    private readonly bus: ReleaseGovernanceEventBus
  ) {}

  async initiateOrchestration(params: InitiateOrchestrationParams): Promise<AtcReleaseOrchestration> {
    const record = await this.repo.upsert(params)
    await this.audit.append(record.id, 'orchestration.initiated', { orchestrationId: record.orchestrationId })
    this.bus.emit('orchestration.initiated', { orchestrationId: record.orchestrationId }).catch(() => undefined)
    return record
  }

  async runOrchestration(orchestrationId: string): Promise<AtcReleaseOrchestration> {
    const record = await this.repo.updateStatus(orchestrationId, 'running')
    this.bus.emit('orchestration.running', { orchestrationId: record.orchestrationId }).catch(() => undefined)
    return record
  }

  async completeOrchestration(orchestrationId: string): Promise<AtcReleaseOrchestration> {
    const record = await this.repo.updateStatus(orchestrationId, 'completed')
    await this.audit.append(record.id, 'orchestration.completed', { orchestrationId: record.orchestrationId })
    this.bus.emit('orchestration.completed', { orchestrationId: record.orchestrationId }).catch(() => undefined)
    return record
  }

  async getOrchestration(orchestrationId: string): Promise<AtcReleaseOrchestration | null> {
    return this.repo.findByOrchestrationId(orchestrationId)
  }
}
