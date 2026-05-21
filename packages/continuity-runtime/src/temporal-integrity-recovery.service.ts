import type { ContinuityRuntimeRepository } from './continuity-runtime.repository.js'
import type { TemporalRecoveryRepository } from './temporal-recovery.repository.js'
import type { CheckpointRuntimeRepository } from './checkpoint-runtime.repository.js'
import type { InfinitePersistenceRepository } from './infinite-persistence.repository.js'
import type {
  TemporalIntegrityRepository,
  AtcTemporalIntegrity,
  CreateTemporalIntegrityParams,
} from './temporal-integrity.repository.js'
import type { ContinuityAuditRepository } from './continuity-audit.repository.js'

export interface ContinuityRuntimeEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export interface ContinuityCleanupResult {
  continuities: number
  recoveries: number
  checkpoints: number
  persistenceNodes: number
  temporalIntegrities: number
}

export class TemporalIntegrityRecoveryService {
  constructor(
    private continuityRepo: ContinuityRuntimeRepository,
    private recoveryRepo: TemporalRecoveryRepository,
    private checkpointRepo: CheckpointRuntimeRepository,
    private persistenceRepo: InfinitePersistenceRepository,
    private temporalIntegrityRepo: TemporalIntegrityRepository,
    private auditRepo: ContinuityAuditRepository,
    private eventBus: ContinuityRuntimeEventBus,
  ) {}

  async createTemporalIntegrity(params: CreateTemporalIntegrityParams): Promise<AtcTemporalIntegrity> {
    const record = await this.temporalIntegrityRepo.create(params)
    await this.auditRepo.append({
      eventType: 'temporal_integrity_created',
      continuityId: record.integrityId,
      ownerServerId: record.ownerServerId,
      auditData: { integrityType: record.integrityType },
    })
    this.eventBus.emit('atc:continuity:temporal-integrity:created', { integrityId: record.integrityId }).catch(() => undefined)
    return record
  }

  async repairTemporalIntegrity(id: string): Promise<AtcTemporalIntegrity> {
    const record = await this.temporalIntegrityRepo.updateStatus(id, 'repaired', new Date())
    await this.auditRepo.append({
      eventType: 'temporal_integrity_repaired',
      continuityId: record.integrityId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:continuity:temporal-integrity:repaired', { integrityId: record.integrityId }).catch(() => undefined)
    return record
  }

  async validateTemporalIntegrity(id: string): Promise<AtcTemporalIntegrity> {
    const record = await this.temporalIntegrityRepo.updateStatus(id, 'valid')
    await this.auditRepo.append({
      eventType: 'temporal_integrity_validated',
      continuityId: record.integrityId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:continuity:temporal-integrity:validated', { integrityId: record.integrityId }).catch(() => undefined)
    return record
  }

  async getTemporalIntegrity(id: string): Promise<AtcTemporalIntegrity | null> {
    return this.temporalIntegrityRepo.findById(id)
  }

  async cleanupStale(thresholdMs: number): Promise<ContinuityCleanupResult> {
    const [continuities, recoveries, checkpoints, persistenceNodes, temporalIntegrities] = await Promise.all([
      this.continuityRepo.cleanupStale(thresholdMs),
      this.recoveryRepo.cleanupStale(thresholdMs),
      this.checkpointRepo.cleanupStale(thresholdMs),
      this.persistenceRepo.cleanupStale(thresholdMs),
      this.temporalIntegrityRepo.cleanupStale(thresholdMs),
    ])

    await this.auditRepo.append({
      eventType: 'stale_cleanup',
      auditData: { continuities, recoveries, checkpoints, persistenceNodes, temporalIntegrities, thresholdMs },
    })

    this.eventBus.emit('atc:continuity:stale:cleaned', {
      continuities,
      recoveries,
      checkpoints,
      persistenceNodes,
      temporalIntegrities,
    }).catch(() => undefined)

    return { continuities, recoveries, checkpoints, persistenceNodes, temporalIntegrities }
  }
}
