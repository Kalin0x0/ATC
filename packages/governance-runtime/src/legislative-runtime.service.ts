import type { GovernanceRuntimeEventBus } from './governance-recovery.service.js'
import type { GovernanceAuditRepository } from './governance-audit.repository.js'
import type {
  AtcLegislativeRuntime,
  AtcLegislationType,
} from './legislative.repository.js'
import { LegislativeRepository } from './legislative.repository.js'
import { LegislationNotFoundError } from './errors.js'

export interface EnactLegislationParams {
  legislationId: string
  legislationType: AtcLegislationType
  ownerServerId: string
  regionId?: string | null | undefined
  legislationNonce: string
  legislationData?: Record<string, unknown> | undefined
  enactedAt?: Date | undefined
  expiresAt?: Date | null | undefined
}

export class LegislativeRuntimeService {
  constructor(
    private readonly legislationRepo: LegislativeRepository,
    private readonly auditRepo: GovernanceAuditRepository,
    private readonly eventBus: GovernanceRuntimeEventBus,
  ) {}

  async enactLegislation(params: EnactLegislationParams): Promise<AtcLegislativeRuntime> {
    const legislation = await this.legislationRepo.create({
      legislationId: params.legislationId,
      legislationType: params.legislationType,
      ownerServerId: params.ownerServerId,
      regionId: params.regionId,
      legislationNonce: params.legislationNonce,
      legislationData: params.legislationData,
      enactedAt: params.enactedAt,
      expiresAt: params.expiresAt,
    })

    await this.auditRepo.append({
      eventType: 'governance:legislation:enacted',
      entityId: legislation.legislationId,
      ownerServerId: legislation.ownerServerId,
      regionId: legislation.regionId ?? undefined,
      auditData: {
        legislationType: legislation.legislationType,
        nonce: legislation.legislationNonce,
        expiresAt: legislation.expiresAt,
      },
    })

    this.eventBus.emit('atc:governance:legislation:enacted', {
      id: legislation.id,
      legislationId: legislation.legislationId,
      legislationType: legislation.legislationType,
      ownerServerId: legislation.ownerServerId,
      regionId: legislation.regionId,
    }).catch(() => undefined)

    return legislation
  }

  async repealLegislation(id: string): Promise<AtcLegislativeRuntime> {
    const legislation = await this.legislationRepo.findById(id)
    if (!legislation) throw new LegislationNotFoundError(id)

    const updated = await this.legislationRepo.updateStatus(id, 'repealed')

    await this.auditRepo.append({
      eventType: 'governance:legislation:repealed',
      entityId: updated.legislationId,
      ownerServerId: updated.ownerServerId,
      regionId: updated.regionId ?? undefined,
      auditData: { previousStatus: legislation.status },
    })

    this.eventBus.emit('atc:governance:legislation:repealed', {
      id: updated.id,
      legislationId: updated.legislationId,
      ownerServerId: updated.ownerServerId,
      regionId: updated.regionId,
    }).catch(() => undefined)

    return updated
  }

  async getLegislation(id: string): Promise<AtcLegislativeRuntime | null> {
    return this.legislationRepo.findById(id)
  }

  async listActiveLegislation(regionId?: string): Promise<AtcLegislativeRuntime[]> {
    return this.legislationRepo.listActive(regionId)
  }
}
