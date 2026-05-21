import type {
  ReleaseGovernanceRepository,
  AtcReleaseGovernance,
  CreateGovernanceParams,
} from './release-governance.repository.js'
import type { ReleaseAuditRepository } from './release-audit.repository.js'

export interface ReleaseGovernanceEventBus {
  emit(event: string, data: Record<string, unknown>): Promise<void>
}

export class ReleaseGovernanceService {
  constructor(
    private readonly repo: ReleaseGovernanceRepository,
    private readonly audit: ReleaseAuditRepository,
    private readonly bus: ReleaseGovernanceEventBus
  ) {}

  async initiateGovernance(params: CreateGovernanceParams): Promise<AtcReleaseGovernance> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'governance.initiated', { governanceId: record.governanceId })
    this.bus.emit('governance.initiated', { governanceId: record.governanceId }).catch(() => undefined)
    return record
  }

  async startGovernance(id: string): Promise<AtcReleaseGovernance> {
    const record = await this.repo.updateStatus(id, 'active', new Date())
    await this.audit.append(record.id, 'release_started', { governanceId: record.governanceId })
    this.bus.emit('release_started', { governanceId: record.governanceId }).catch(() => undefined)
    return record
  }

  async approveGovernance(id: string): Promise<AtcReleaseGovernance> {
    const record = await this.repo.updateStatus(id, 'approved')
    await this.audit.append(record.id, 'governance.approved', { governanceId: record.governanceId })
    this.bus.emit('governance.approved', { governanceId: record.governanceId }).catch(() => undefined)
    return record
  }

  async rejectGovernance(id: string): Promise<AtcReleaseGovernance> {
    const record = await this.repo.updateStatus(id, 'rejected')
    this.bus.emit('governance.rejected', { governanceId: record.governanceId }).catch(() => undefined)
    return record
  }

  async getGovernance(id: string): Promise<AtcReleaseGovernance | null> {
    return this.repo.findById(id)
  }
}
