import type {
  GlobalReleaseRuntimeRepository,
  AtcGlobalReleaseRuntime,
  CreateGlobalReleaseParams,
} from './global-release-runtime.repository.js'
import type { ReleaseAuditRepository } from './release-audit.repository.js'
import type { ReleaseGovernanceEventBus } from './release-governance.service.js'

export class GlobalDeploymentGovernanceService {
  constructor(
    private readonly repo: GlobalReleaseRuntimeRepository,
    private readonly audit: ReleaseAuditRepository,
    private readonly bus: ReleaseGovernanceEventBus
  ) {}

  async createRelease(params: CreateGlobalReleaseParams): Promise<AtcGlobalReleaseRuntime> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'global_release.created', { releaseId: record.releaseId })
    this.bus.emit('global_release.created', { releaseId: record.releaseId }).catch(() => undefined)
    return record
  }

  async activateRelease(id: string): Promise<AtcGlobalReleaseRuntime> {
    const record = await this.repo.updateStatus(id, 'active')
    this.bus.emit('global_release.active', { releaseId: record.releaseId }).catch(() => undefined)
    return record
  }

  async completeRelease(id: string): Promise<AtcGlobalReleaseRuntime> {
    const record = await this.repo.updateStatus(id, 'completed', new Date())
    await this.audit.append(record.id, 'production_release_completed', { releaseId: record.releaseId })
    this.bus.emit('production_release_completed', { releaseId: record.releaseId }).catch(() => undefined)
    return record
  }

  async revertRelease(id: string): Promise<AtcGlobalReleaseRuntime> {
    const record = await this.repo.updateStatus(id, 'reverted')
    this.bus.emit('global_release.reverted', { releaseId: record.releaseId }).catch(() => undefined)
    return record
  }

  async getRelease(id: string): Promise<AtcGlobalReleaseRuntime | null> {
    return this.repo.findById(id)
  }
}
