import type { RuntimeTuningRepository, AtcRuntimeTuning, AtcTuningType } from './runtime-tuning.repository.js'
import type { EvolutionAuditRepository } from './evolution-audit.repository.js'
import type { EvolutionRuntimeEventBus } from './evolution-recovery.service.js'

export interface UpsertTuningServiceParams {
  entityId: string
  tuningType: AtcTuningType
  ownerServerId: string
  tuningData?: Record<string, unknown> | undefined
}

export class RuntimeTuningService {
  constructor(
    private readonly tuningRepo: RuntimeTuningRepository,
    private readonly auditRepo: EvolutionAuditRepository,
    private readonly eventBus: EvolutionRuntimeEventBus,
  ) {}

  async upsertTuning(params: UpsertTuningServiceParams): Promise<AtcRuntimeTuning> {
    const tuning = await this.tuningRepo.upsert(params)
    this.eventBus.emit('atc:evolution:tuning:upserted', { entityId: tuning.entityId, tuningType: tuning.tuningType, status: tuning.status }).catch(() => undefined)
    return tuning
  }

  async getTuning(entityId: string): Promise<AtcRuntimeTuning | null> {
    return this.tuningRepo.findByEntity(entityId)
  }
}
