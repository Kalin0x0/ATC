import type {
  ProductionSealRepository,
  AtcProductionSeal,
  CreateProductionSealParams,
} from './production-seal.repository.js'
import type { CoreFinalizationAuditRepository } from './core-finalization-audit.repository.js'
import type { CoreFinalizationEventBus } from './finalization-recovery.service.js'

export class DistributedFinalSealService {
  constructor(
    private repo: ProductionSealRepository,
    private auditRepo: CoreFinalizationAuditRepository,
    private eventBus: CoreFinalizationEventBus,
  ) {}

  async applyFinalSeal(params: CreateProductionSealParams): Promise<AtcProductionSeal> {
    const record = await this.repo.create(params)
    await this.auditRepo.append({
      eventType: 'seal_applied',
      finalizationId: record.sealId,
      ownerServerId: record.ownerServerId,
      auditData: { sealType: record.sealType, resourceId: record.resourceId },
    })
    this.eventBus.emit('atc:core-finalization-runtime:seal:applied', {
      sealId: record.sealId,
      resourceId: record.resourceId,
    }).catch(() => undefined)
    return record
  }

  async lockSeal(id: string): Promise<AtcProductionSeal> {
    const record = await this.repo.updateStatus(id, 'locked', new Date())
    await this.auditRepo.append({
      eventType: 'seal_locked',
      finalizationId: record.sealId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:core-finalization-runtime:seal:locked', {
      sealId: record.sealId,
    }).catch(() => undefined)
    return record
  }

  async breakSeal(id: string): Promise<AtcProductionSeal> {
    const record = await this.repo.updateStatus(id, 'broken')
    await this.auditRepo.append({
      eventType: 'seal_broken',
      finalizationId: record.sealId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:core-finalization-runtime:seal:broken', {
      sealId: record.sealId,
    }).catch(() => undefined)
    return record
  }

  async expireSeal(id: string): Promise<AtcProductionSeal> {
    const record = await this.repo.updateStatus(id, 'expired')
    await this.auditRepo.append({
      eventType: 'seal_expired',
      finalizationId: record.sealId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:core-finalization-runtime:seal:expired', {
      sealId: record.sealId,
    }).catch(() => undefined)
    return record
  }

  async getSeal(id: string): Promise<AtcProductionSeal | null> {
    return this.repo.findById(id)
  }
}
