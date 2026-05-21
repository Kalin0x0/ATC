import type { TemporalRecoveryRepository, AtcTemporalRecovery, AtcTemporalRecoveryType } from './temporal-recovery.repository.js'
import type { ContinuityAuditRepository } from './continuity-audit.repository.js'
import type { ContinuityRuntimeEventBus } from './temporal-integrity-recovery.service.js'

export interface InitiateRecoveryServiceParams {
  recoveryType: AtcTemporalRecoveryType
  ownerServerId: string
  recoveryNonce: string
  targetTimestamp?: Date | undefined
  recoveryData?: Record<string, unknown> | undefined
}

export class TemporalRecoveryService {
  constructor(
    private repo: TemporalRecoveryRepository,
    private audit: ContinuityAuditRepository,
    private eventBus: ContinuityRuntimeEventBus,
  ) {}

  async initiateRecovery(params: InitiateRecoveryServiceParams): Promise<AtcTemporalRecovery> {
    const record = await this.repo.create({
      recoveryType: params.recoveryType,
      ownerServerId: params.ownerServerId,
      recoveryNonce: params.recoveryNonce,
      targetTimestamp: params.targetTimestamp,
      recoveryData: params.recoveryData,
    })
    await this.audit.append({
      eventType: 'recovery_initiated',
      continuityId: record.recoveryId,
      ownerServerId: record.ownerServerId,
      auditData: { recoveryType: record.recoveryType },
    })
    this.eventBus.emit('atc:continuity:recovery:initiated', { recoveryId: record.recoveryId }).catch(() => undefined)
    return record
  }

  async beginRecovering(id: string): Promise<AtcTemporalRecovery> {
    const record = await this.repo.updateStatus(id, 'recovering')
    await this.audit.append({
      eventType: 'recovery_began',
      continuityId: record.recoveryId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:continuity:recovery:began', { recoveryId: record.recoveryId }).catch(() => undefined)
    return record
  }

  async completeRecovery(id: string): Promise<AtcTemporalRecovery> {
    const record = await this.repo.updateStatus(id, 'completed', new Date())
    await this.audit.append({
      eventType: 'recovery_completed',
      continuityId: record.recoveryId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:continuity:recovery:completed', { recoveryId: record.recoveryId }).catch(() => undefined)
    return record
  }

  async failRecovery(id: string): Promise<AtcTemporalRecovery> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.audit.append({
      eventType: 'recovery_failed',
      continuityId: record.recoveryId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:continuity:recovery:failed', { recoveryId: record.recoveryId }).catch(() => undefined)
    return record
  }

  async getRecovery(id: string): Promise<AtcTemporalRecovery | null> {
    return this.repo.findById(id)
  }
}
