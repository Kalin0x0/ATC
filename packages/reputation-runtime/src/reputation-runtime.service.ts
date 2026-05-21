import type { AtcInfluenceChangeType } from './influence-history.repository.js'
import type { InfluenceHistoryRepository } from './influence-history.repository.js'
import type { RelationshipAuditRepository } from './relationship-audit.repository.js'
import type {
  AtcReputationRuntime,
  AtcReputationTier,
  ReputationRuntimeRepository,
} from './reputation-runtime.repository.js'

export interface EventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export class ReputationRuntimeService {
  constructor(
    private readonly reputationRepo: ReputationRuntimeRepository,
    private readonly influenceRepo: InfluenceHistoryRepository,
    private readonly auditRepo: RelationshipAuditRepository,
    private readonly eventBus?: EventBus,
  ) {}

  async getReputation(
    principalId: string,
    factionId: string,
  ): Promise<AtcReputationRuntime | null> {
    return this.reputationRepo.findByPrincipalAndFaction(principalId, factionId)
  }

  async updateReputation(
    principalId: string,
    factionId: string,
    score: number,
    tier: AtcReputationTier,
  ): Promise<AtcReputationRuntime> {
    const record = await this.reputationRepo.upsert(principalId, factionId, score, tier)
    await this.auditRepo
      .record(
        principalId,
        'reputation',
        'update',
        undefined,
        JSON.stringify({ factionId, score, tier }),
      )
      .catch(() => undefined)
    return record
  }

  async adjustReputation(
    principalId: string,
    factionId: string,
    delta: number,
    reason: string,
    actorId?: string,
  ): Promise<AtcReputationRuntime> {
    const record = await this.reputationRepo.adjustScore(principalId, factionId, delta)

    const changeType: AtcInfluenceChangeType = delta >= 0 ? 'gain' : 'loss'
    await this.influenceRepo
      .record(principalId, delta, changeType, reason, factionId, actorId)
      .catch(() => undefined)

    await this.auditRepo
      .record(
        principalId,
        'reputation',
        'adjust',
        actorId,
        JSON.stringify({ factionId, delta, reason }),
      )
      .catch(() => undefined)

    this.eventBus
      ?.emit('atc:reputation:changed', { principalId, factionId, delta })
      .catch(() => undefined)

    return record
  }
}
