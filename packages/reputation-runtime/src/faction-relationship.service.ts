import type {
  AtcDiplomaticRelation,
  AtcDiplomaticStatus,
  DiplomaticRelationsRepository,
} from './diplomatic-relations.repository.js'
import type { RelationshipAuditRepository } from './relationship-audit.repository.js'
import type { EventBus } from './reputation-runtime.service.js'

export class FactionRelationshipService {
  constructor(
    private readonly diplomaticRepo: DiplomaticRelationsRepository,
    private readonly auditRepo: RelationshipAuditRepository,
    private readonly eventBus?: EventBus,
  ) {}

  async updateFactionRelation(
    factionAId: string,
    factionBId: string,
    status: AtcDiplomaticStatus,
    score: number,
  ): Promise<AtcDiplomaticRelation> {
    const record = await this.diplomaticRepo.upsert(factionAId, factionBId, status, score)

    await this.auditRepo
      .record(
        factionAId,
        'faction_relation',
        'update',
        undefined,
        JSON.stringify({ factionBId, status, score }),
      )
      .catch(() => undefined)

    this.eventBus
      ?.emit('atc:reputation:faction:relation:updated', { factionAId, factionBId })
      .catch(() => undefined)

    return record
  }

  async listFactionRelations(factionId: string): Promise<AtcDiplomaticRelation[]> {
    return this.diplomaticRepo.listByFaction(factionId)
  }

  async removeFactionRelation(factionAId: string, factionBId: string): Promise<void> {
    await this.diplomaticRepo.delete(factionAId, factionBId)

    await this.auditRepo
      .record(
        factionAId,
        'faction_relation',
        'remove',
        undefined,
        JSON.stringify({ factionBId }),
      )
      .catch(() => undefined)
  }
}
