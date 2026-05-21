import type { GovernanceRuntimeEventBus } from './governance-recovery.service.js'
import type { GovernanceAuditRepository } from './governance-audit.repository.js'
import type {
  AtcCivicInfluence,
  AtcInfluenceType,
} from './civic-influence.repository.js'
import { CivicInfluenceRepository } from './civic-influence.repository.js'

export interface UpsertInfluenceParams {
  entityId: string
  influenceType: AtcInfluenceType
  influenceScore: number
  ownerServerId: string
  regionId?: string | null | undefined
  influenceData?: Record<string, unknown> | undefined
}

export class CivicInfluenceService {
  constructor(
    private readonly civicInfluenceRepo: CivicInfluenceRepository,
    private readonly auditRepo: GovernanceAuditRepository,
    private readonly eventBus: GovernanceRuntimeEventBus,
  ) {}

  async upsertInfluence(params: UpsertInfluenceParams): Promise<AtcCivicInfluence> {
    const influence = await this.civicInfluenceRepo.upsert({
      entityId: params.entityId,
      influenceType: params.influenceType,
      influenceScore: params.influenceScore,
      ownerServerId: params.ownerServerId,
      regionId: params.regionId,
      influenceData: params.influenceData,
    })

    await this.auditRepo.append({
      eventType: 'governance:influence:updated',
      entityId: influence.entityId,
      ownerServerId: influence.ownerServerId,
      regionId: influence.regionId ?? undefined,
      auditData: {
        influenceType: influence.influenceType,
        influenceScore: influence.influenceScore,
      },
    })

    this.eventBus.emit('atc:governance:influence:updated', {
      id: influence.id,
      entityId: influence.entityId,
      influenceType: influence.influenceType,
      influenceScore: influence.influenceScore,
      ownerServerId: influence.ownerServerId,
      regionId: influence.regionId,
    }).catch(() => undefined)

    return influence
  }

  async getInfluence(entityId: string): Promise<AtcCivicInfluence | null> {
    return this.civicInfluenceRepo.findByEntity(entityId)
  }

  async cleanupInactive(thresholdMs: number): Promise<number> {
    return this.civicInfluenceRepo.cleanupInactive(thresholdMs)
  }
}
