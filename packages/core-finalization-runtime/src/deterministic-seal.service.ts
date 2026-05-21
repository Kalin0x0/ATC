import type {
  DeterministicSealingRepository,
  AtcDeterministicSealing,
  CreateDeterministicSealingParams,
} from './deterministic-sealing.repository.js'
import type { CoreFinalizationAuditRepository } from './core-finalization-audit.repository.js'
import type { CoreFinalizationEventBus } from './finalization-recovery.service.js'

export class DeterministicSealService {
  constructor(
    private repo: DeterministicSealingRepository,
    private auditRepo: CoreFinalizationAuditRepository,
    private eventBus: CoreFinalizationEventBus,
  ) {}

  async createSealing(params: CreateDeterministicSealingParams): Promise<AtcDeterministicSealing> {
    const record = await this.repo.create(params)
    await this.auditRepo.append({
      eventType: 'sealing_created',
      finalizationId: record.sealingId,
      ownerServerId: record.ownerServerId,
      auditData: { sealingType: record.sealingType },
    })
    this.eventBus.emit('atc:core-finalization-runtime:sealing:created', {
      sealingId: record.sealingId,
    }).catch(() => undefined)
    return record
  }

  async beginSealing(id: string): Promise<AtcDeterministicSealing> {
    const record = await this.repo.updateStatus(id, 'sealing')
    await this.auditRepo.append({
      eventType: 'sealing_begun',
      finalizationId: record.sealingId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:core-finalization-runtime:sealing:begun', {
      sealingId: record.sealingId,
    }).catch(() => undefined)
    return record
  }

  async applySealing(id: string): Promise<AtcDeterministicSealing> {
    const record = await this.repo.updateStatus(id, 'sealed', new Date())
    await this.auditRepo.append({
      eventType: 'sealing_applied',
      finalizationId: record.sealingId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:core-finalization-runtime:sealing:applied', {
      sealingId: record.sealingId,
    }).catch(() => undefined)
    return record
  }

  async breakSealing(id: string): Promise<AtcDeterministicSealing> {
    const record = await this.repo.updateStatus(id, 'broken')
    await this.auditRepo.append({
      eventType: 'sealing_broken',
      finalizationId: record.sealingId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:core-finalization-runtime:sealing:broken', {
      sealingId: record.sealingId,
    }).catch(() => undefined)
    return record
  }

  async getSealing(id: string): Promise<AtcDeterministicSealing | null> {
    return this.repo.findById(id)
  }
}
