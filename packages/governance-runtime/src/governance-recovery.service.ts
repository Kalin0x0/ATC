import type { GovernanceRuntimeRepository } from './governance-runtime.repository.js'
import type { ElectionRepository } from './election.repository.js'
import type { LegislativeRepository } from './legislative.repository.js'
import type { PolicyRepository } from './policy.repository.js'
import type { GovernanceAuditRepository } from './governance-audit.repository.js'

export interface GovernanceRuntimeEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export interface CleanupStaleResult {
  governances: number
  elections: number
  legislations: number
  policies: number
}

export class GovernanceRecoveryService {
  constructor(
    private readonly governanceRepo: GovernanceRuntimeRepository,
    private readonly electionRepo: ElectionRepository,
    private readonly legislationRepo: LegislativeRepository,
    private readonly policyRepo: PolicyRepository,
    private readonly auditRepo: GovernanceAuditRepository,
    private readonly eventBus: GovernanceRuntimeEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<CleanupStaleResult> {
    const [governances, elections, legislations, policies] = await Promise.all([
      this.governanceRepo.cleanupStale(thresholdMs),
      this.electionRepo.cleanupStale(thresholdMs),
      this.legislationRepo.cleanupStale(thresholdMs),
      this.policyRepo.cleanupStale(thresholdMs),
    ])

    await this.auditRepo.append({
      eventType: 'governance:recovery:cleanup',
      auditData: { governances, elections, legislations, policies, thresholdMs },
    })

    this.eventBus.emit('atc:governance:recovery:cleanup', {
      governances,
      elections,
      legislations,
      policies,
      thresholdMs,
    }).catch(() => undefined)

    return { governances, elections, legislations, policies }
  }
}
