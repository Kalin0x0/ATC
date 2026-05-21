import type { AtcEventBus } from '@atc/events'
import type { EvacuationRuntimeRepository } from './evacuation-runtime.repository.js'
import type { DisasterAuditRepository } from './disaster-audit.repository.js'
import type { AtcEvacuationRuntime } from './evacuation-runtime.repository.js'

export interface InitiateEvacuationParams {
  evacuationNonce: string
  disasterId?: string | undefined
  zoneId: string
  evacuationType: string
  targetCount?: number | undefined
}

export class EvacuationRuntimeService {
  private readonly evacuationRepo: EvacuationRuntimeRepository
  private readonly auditRepo: DisasterAuditRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(
    evacuationRepo: EvacuationRuntimeRepository,
    auditRepo: DisasterAuditRepository,
    eventBus: AtcEventBus | undefined,
  ) {
    this.evacuationRepo = evacuationRepo
    this.auditRepo = auditRepo
    this.eventBus = eventBus
  }

  async initiateEvacuation(params: InitiateEvacuationParams): Promise<AtcEvacuationRuntime> {
    const evacuation = await this.evacuationRepo.create({
      evacuationNonce: params.evacuationNonce,
      ...(params.disasterId !== undefined ? { disasterId: params.disasterId } : {}),
      zoneId: params.zoneId,
      evacuationType: params.evacuationType,
      ...(params.targetCount !== undefined ? { targetCount: params.targetCount } : {}),
    })
    await this.auditRepo.record(
      evacuation.evacuationId,
      'evacuation',
      'initiated',
      undefined,
      `zoneId=${params.zoneId} type=${params.evacuationType}`,
    )
    this.eventBus?.emit('atc:disaster:evacuation:initiated', {
      evacuationId: evacuation.evacuationId,
      zoneId: evacuation.zoneId,
    }).catch(() => undefined)
    return evacuation
  }

  async updateProgress(evacuationId: string, evacuatedCount: number): Promise<AtcEvacuationRuntime> {
    const evacuation = await this.evacuationRepo.updateProgress(evacuationId, evacuatedCount)
    this.eventBus?.emit('atc:disaster:evacuation:progress', {
      evacuationId: evacuation.evacuationId,
      evacuatedCount: evacuation.evacuatedCount,
    }).catch(() => undefined)
    return evacuation
  }

  async completeEvacuation(evacuationId: string): Promise<AtcEvacuationRuntime> {
    const evacuation = await this.evacuationRepo.transition(evacuationId, 'completed')
    await this.auditRepo.record(evacuation.evacuationId, 'evacuation', 'completed')
    this.eventBus?.emit('atc:disaster:evacuation:completed', {
      evacuationId: evacuation.evacuationId,
    }).catch(() => undefined)
    return evacuation
  }

  async cancelEvacuation(evacuationId: string): Promise<AtcEvacuationRuntime> {
    const evacuation = await this.evacuationRepo.transition(evacuationId, 'cancelled')
    await this.auditRepo.record(evacuation.evacuationId, 'evacuation', 'cancelled')
    this.eventBus?.emit('atc:disaster:evacuation:cancelled', {
      evacuationId: evacuation.evacuationId,
    }).catch(() => undefined)
    return evacuation
  }
}
