import type { GlobalGovernanceRepository } from './global-governance.repository.js'
import type { CrossSystemArbitrationRepository } from './crosssystem-arbitration.repository.js'
import type { RuntimeConsensusRepository } from './runtime-consensus.repository.js'
import type { GlobalPolicyRepository } from './global-policy.repository.js'
import type { GlobalOwnershipRepository } from './global-ownership.repository.js'
import type { GovernanceContinuityAuditRepository } from './governance-continuity-audit.repository.js'

export interface GlobalGovernanceEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export interface GlobalGovernanceCleanupResult {
  directives: number
  arbitrations: number
  consensuses: number
  policies: number
  ownerships: number
}

export class GovernanceContinuityService {
  constructor(
    private directiveRepo: GlobalGovernanceRepository,
    private arbitrationRepo: CrossSystemArbitrationRepository,
    private consensusRepo: RuntimeConsensusRepository,
    private policyRepo: GlobalPolicyRepository,
    private ownershipRepo: GlobalOwnershipRepository,
    private auditRepo: GovernanceContinuityAuditRepository,
    private eventBus: GlobalGovernanceEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<GlobalGovernanceCleanupResult> {
    const [directives, arbitrations, consensuses, policies, ownerships] = await Promise.all([
      this.directiveRepo.cleanupStale(thresholdMs),
      this.arbitrationRepo.cleanupStale(thresholdMs),
      this.consensusRepo.cleanupStale(thresholdMs),
      this.policyRepo.cleanupStale(thresholdMs),
      this.ownershipRepo.cleanupStale(thresholdMs),
    ])

    await this.auditRepo.append({
      eventType: 'stale_cleanup',
      auditData: { directives, arbitrations, consensuses, policies, ownerships, thresholdMs },
    })

    this.eventBus.emit('atc:global-governance:stale:cleaned', {
      directives,
      arbitrations,
      consensuses,
      policies,
      ownerships,
    }).catch(() => undefined)

    return { directives, arbitrations, consensuses, policies, ownerships }
  }
}
