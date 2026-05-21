import type { ContinuityRuntimeRepository, AtcRuntimeContinuity, AtcContinuityType } from './continuity-runtime.repository.js'
import type { ContinuityAuditRepository } from './continuity-audit.repository.js'
import type { ContinuityRuntimeEventBus } from './temporal-integrity-recovery.service.js'

export interface CreateContinuityServiceParams {
  continuityType: AtcContinuityType
  ownerServerId: string
  continuityNonce: string
  continuityData?: Record<string, unknown> | undefined
}

export class ContinuityRuntimeService {
  constructor(
    private repo: ContinuityRuntimeRepository,
    private audit: ContinuityAuditRepository,
    private eventBus: ContinuityRuntimeEventBus,
  ) {}

  async createContinuity(params: CreateContinuityServiceParams): Promise<AtcRuntimeContinuity> {
    const record = await this.repo.create({
      continuityType: params.continuityType,
      ownerServerId: params.ownerServerId,
      continuityNonce: params.continuityNonce,
      continuityData: params.continuityData,
    })
    await this.audit.append({
      eventType: 'continuity_created',
      continuityId: record.continuityId,
      ownerServerId: record.ownerServerId,
      auditData: { continuityType: record.continuityType },
    })
    this.eventBus.emit('atc:continuity:continuity:created', { continuityId: record.continuityId }).catch(() => undefined)
    return record
  }

  async suspendContinuity(id: string): Promise<AtcRuntimeContinuity> {
    const record = await this.repo.updateStatus(id, 'suspended')
    await this.audit.append({
      eventType: 'continuity_suspended',
      continuityId: record.continuityId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:continuity:continuity:suspended', { continuityId: record.continuityId }).catch(() => undefined)
    return record
  }

  async terminateContinuity(id: string): Promise<AtcRuntimeContinuity> {
    const record = await this.repo.updateStatus(id, 'terminated', new Date())
    await this.audit.append({
      eventType: 'continuity_terminated',
      continuityId: record.continuityId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:continuity:continuity:terminated', { continuityId: record.continuityId }).catch(() => undefined)
    return record
  }

  async failContinuity(id: string): Promise<AtcRuntimeContinuity> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.audit.append({
      eventType: 'continuity_failed',
      continuityId: record.continuityId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:continuity:continuity:failed', { continuityId: record.continuityId }).catch(() => undefined)
    return record
  }

  async getContinuity(id: string): Promise<AtcRuntimeContinuity | null> {
    return this.repo.findById(id)
  }
}
