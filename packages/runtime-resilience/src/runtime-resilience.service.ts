import type { RuntimeResilienceRepository, AtcResilienceRecord, UpsertResilienceParams, AtcResilienceStatus } from './runtime-resilience.repository.js'
import type { RuntimeResilienceEventBus } from './runtime-recovery-coordinator.js'

export class RuntimeResilienceService {
  constructor(
    private resilienceRepo: RuntimeResilienceRepository,
    private eventBus: RuntimeResilienceEventBus,
  ) {}

  async upsertHealth(params: UpsertResilienceParams): Promise<AtcResilienceRecord> {
    return this.resilienceRepo.upsert(params)
  }

  async getHealthStatus(recordId: string): Promise<AtcResilienceRecord | null> {
    return this.resilienceRepo.findByRecordId(recordId)
  }

  async updateHealthScore(recordId: string, healthScore: number): Promise<AtcResilienceRecord> {
    const status: AtcResilienceStatus =
      healthScore >= 80
        ? 'healthy'
        : healthScore >= 50
          ? 'degraded'
          : healthScore >= 20
            ? 'critical'
            : 'failed'
    const record = await this.resilienceRepo.updateHealthScore(recordId, healthScore, status)
    if (status !== 'healthy') {
      this.eventBus.emit('atc:resilience:health:degraded', { recordId, healthScore, status }).catch(() => undefined)
    }
    return record
  }

  async listAll(ownerServerId?: string): Promise<AtcResilienceRecord[]> {
    return this.resilienceRepo.listAll(ownerServerId)
  }
}
