import type {
  AtcInfluenceChangeType,
  AtcInfluenceHistory,
  InfluenceHistoryRepository,
} from './influence-history.repository.js'
import type { RelationshipAuditRepository } from './relationship-audit.repository.js'
import type { EventBus } from './reputation-runtime.service.js'

export class InfluenceTrackingService {
  constructor(
    private readonly influenceRepo: InfluenceHistoryRepository,
    private readonly auditRepo: RelationshipAuditRepository,
    private readonly eventBus?: EventBus,
  ) {}

  async recordChange(
    principalId: string,
    changeAmount: number,
    changeType: AtcInfluenceChangeType,
    changeReason: string,
    factionId?: string,
    actorId?: string,
  ): Promise<void> {
    await this.influenceRepo.record(
      principalId,
      changeAmount,
      changeType,
      changeReason,
      factionId,
      actorId,
    )

    await this.auditRepo
      .record(
        principalId,
        'influence',
        'record',
        actorId,
        JSON.stringify({
          changeAmount,
          changeType,
          changeReason,
          ...(factionId !== undefined ? { factionId } : {}),
        }),
      )
      .catch(() => undefined)
  }

  async getHistory(
    principalId: string,
    limit?: number,
  ): Promise<AtcInfluenceHistory[]> {
    return this.influenceRepo.listByPrincipal(
      principalId,
      ...(limit !== undefined ? [limit] : []),
    )
  }

  async getHistoryByFaction(
    principalId: string,
    factionId: string,
    limit?: number,
  ): Promise<AtcInfluenceHistory[]> {
    return this.influenceRepo.listByPrincipalAndFaction(
      principalId,
      factionId,
      ...(limit !== undefined ? [limit] : []),
    )
  }
}
