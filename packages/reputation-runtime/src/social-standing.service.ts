import type { RelationshipAuditRepository } from './relationship-audit.repository.js'
import type { EventBus } from './reputation-runtime.service.js'
import type {
  AtcSocialStanding,
  AtcStandingTier,
  SocialStandingRepository,
} from './social-standing.repository.js'

export class SocialStandingService {
  constructor(
    private readonly standingRepo: SocialStandingRepository,
    private readonly auditRepo: RelationshipAuditRepository,
    private readonly eventBus?: EventBus,
  ) {}

  async getStanding(principalId: string): Promise<AtcSocialStanding | null> {
    return this.standingRepo.findByPrincipal(principalId)
  }

  async updateStanding(
    principalId: string,
    score: number,
    tier: AtcStandingTier,
  ): Promise<AtcSocialStanding> {
    const record = await this.standingRepo.upsert(principalId, score, tier)

    await this.auditRepo
      .record(
        principalId,
        'social_standing',
        'update',
        undefined,
        JSON.stringify({ score, tier }),
      )
      .catch(() => undefined)

    return record
  }

  async adjustStanding(
    principalId: string,
    delta: number,
    reason: string,
  ): Promise<AtcSocialStanding> {
    const record = await this.standingRepo.adjust(principalId, delta)

    await this.auditRepo
      .record(
        principalId,
        'social_standing',
        'adjust',
        undefined,
        JSON.stringify({ delta, reason }),
      )
      .catch(() => undefined)

    this.eventBus
      ?.emit('atc:reputation:standing:changed', { principalId, delta })
      .catch(() => undefined)

    return record
  }
}
