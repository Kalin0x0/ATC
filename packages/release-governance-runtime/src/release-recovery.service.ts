import type { ReleaseGovernanceRepository } from './release-governance.repository.js'
import type { ProductionDeploymentRepository } from './production-deployment.repository.js'
import type { ReleaseValidationRepository } from './release-validation.repository.js'
import type { ReleaseOrchestrationRepository } from './release-orchestration.repository.js'
import type { GlobalReleaseRuntimeRepository } from './global-release-runtime.repository.js'
import type { ReleaseAuditRepository } from './release-audit.repository.js'
import type { ReleaseGovernanceEventBus } from './release-governance.service.js'

export interface ReleaseCleanupResult {
  governances: number
  deployments: number
  validations: number
  orchestrations: number
  globalReleases: number
}

export class ReleaseRecoveryService {
  constructor(
    private readonly governanceRepo: ReleaseGovernanceRepository,
    private readonly deploymentRepo: ProductionDeploymentRepository,
    private readonly validationRepo: ReleaseValidationRepository,
    private readonly orchestrationRepo: ReleaseOrchestrationRepository,
    private readonly globalReleaseRepo: GlobalReleaseRuntimeRepository,
    private readonly audit: ReleaseAuditRepository,
    private readonly bus: ReleaseGovernanceEventBus
  ) {}

  async cleanupStale(thresholdMs: number): Promise<ReleaseCleanupResult> {
    const [governances, deployments, validations, orchestrations, globalReleases] = await Promise.all([
      this.governanceRepo.cleanupStale(thresholdMs),
      this.deploymentRepo.cleanupStale(thresholdMs),
      this.validationRepo.cleanupStale(thresholdMs),
      this.orchestrationRepo.cleanupStale(thresholdMs),
      this.globalReleaseRepo.cleanupStale(thresholdMs),
    ])
    this.bus.emit('release.stale_cleaned', { governances, deployments, validations, orchestrations, globalReleases }).catch(() => undefined)
    return { governances, deployments, validations, orchestrations, globalReleases }
  }
}
