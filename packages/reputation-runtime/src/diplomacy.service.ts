import type {
  AtcDiplomaticRelation,
  AtcDiplomaticStatus,
  DiplomaticRelationsRepository,
} from './diplomatic-relations.repository.js'
import type { RelationshipAuditRepository } from './relationship-audit.repository.js'
import type { EventBus } from './reputation-runtime.service.js'

export class DiplomacyService {
  constructor(
    private readonly diplomaticRepo: DiplomaticRelationsRepository,
    private readonly auditRepo: RelationshipAuditRepository,
    private readonly eventBus?: EventBus,
  ) {}

  async setRelation(
    factionAId: string,
    factionBId: string,
    status: AtcDiplomaticStatus,
    score: number,
  ): Promise<AtcDiplomaticRelation> {
    const record = await this.diplomaticRepo.upsert(factionAId, factionBId, status, score)

    await this.auditRepo
      .record(
        factionAId,
        'diplomatic_relation',
        'set',
        undefined,
        JSON.stringify({ factionBId, status, score }),
      )
      .catch(() => undefined)

    this.eventBus
      ?.emit('atc:diplomacy:changed', { factionAId, factionBId, status })
      .catch(() => undefined)

    return record
  }

  async getRelation(
    factionAId: string,
    factionBId: string,
  ): Promise<AtcDiplomaticRelation | null> {
    return this.diplomaticRepo.find(factionAId, factionBId)
  }

  async updateDiplomaticStatus(
    factionAId: string,
    factionBId: string,
    status: AtcDiplomaticStatus,
    score: number,
  ): Promise<AtcDiplomaticRelation> {
    const record = await this.diplomaticRepo.updateStatus(factionAId, factionBId, status, score)

    await this.auditRepo
      .record(
        factionAId,
        'diplomatic_relation',
        'update_status',
        undefined,
        JSON.stringify({ factionBId, status, score }),
      )
      .catch(() => undefined)

    this.eventBus
      ?.emit('atc:diplomacy:changed', { factionAId, factionBId, status })
      .catch(() => undefined)

    return record
  }
}
