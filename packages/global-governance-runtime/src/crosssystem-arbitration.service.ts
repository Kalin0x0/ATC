import type { CrossSystemArbitrationRepository, AtcCrossSystemArbitration, AtcArbitrationType } from './crosssystem-arbitration.repository.js'
import type { GovernanceContinuityAuditRepository } from './governance-continuity-audit.repository.js'
import type { GlobalGovernanceEventBus } from './governance-continuity.service.js'

export interface StartArbitrationParams {
  arbitrationType: AtcArbitrationType
  ownerServerId: string
  arbitrationNonce: string
  arbitrationData?: Record<string, unknown> | undefined
}

export class CrossSystemArbitrationService {
  constructor(
    private repo: CrossSystemArbitrationRepository,
    private audit: GovernanceContinuityAuditRepository,
    private eventBus: GlobalGovernanceEventBus,
  ) {}

  async startArbitration(params: StartArbitrationParams): Promise<AtcCrossSystemArbitration> {
    const record = await this.repo.create({
      arbitrationType: params.arbitrationType,
      ownerServerId: params.ownerServerId,
      arbitrationNonce: params.arbitrationNonce,
      arbitrationData: params.arbitrationData,
    })
    await this.audit.append({
      eventType: 'arbitration_started',
      directiveId: record.arbitrationId,
      ownerServerId: record.ownerServerId,
      auditData: { arbitrationType: record.arbitrationType },
    })
    this.eventBus.emit('atc:global-governance:arbitration:started', { arbitrationId: record.arbitrationId }).catch(() => undefined)
    return record
  }

  async beginArbitrating(id: string): Promise<AtcCrossSystemArbitration> {
    const record = await this.repo.updateStatus(id, 'arbitrating')
    await this.audit.append({
      eventType: 'arbitration_arbitrating',
      directiveId: record.arbitrationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:global-governance:arbitration:arbitrating', { arbitrationId: record.arbitrationId }).catch(() => undefined)
    return record
  }

  async resolveArbitration(id: string): Promise<AtcCrossSystemArbitration> {
    const record = await this.repo.updateStatus(id, 'resolved', new Date())
    await this.audit.append({
      eventType: 'arbitration_resolved',
      directiveId: record.arbitrationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:global-governance:arbitration:resolved', { arbitrationId: record.arbitrationId }).catch(() => undefined)
    return record
  }

  async rejectArbitration(id: string): Promise<AtcCrossSystemArbitration> {
    const record = await this.repo.updateStatus(id, 'rejected')
    await this.audit.append({
      eventType: 'arbitration_rejected',
      directiveId: record.arbitrationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:global-governance:arbitration:rejected', { arbitrationId: record.arbitrationId }).catch(() => undefined)
    return record
  }

  async getArbitration(id: string): Promise<AtcCrossSystemArbitration | null> {
    return this.repo.findById(id)
  }
}
