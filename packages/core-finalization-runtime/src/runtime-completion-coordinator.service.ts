import type {
  FinalizationCoordinationRepository,
  AtcFinalizationCoordination,
  UpsertFinalizationCoordinationParams,
} from './finalization-coordination.repository.js'
import type { CoreFinalizationAuditRepository } from './core-finalization-audit.repository.js'
import type { CoreFinalizationEventBus } from './finalization-recovery.service.js'

export class RuntimeCompletionCoordinator {
  constructor(
    private repo: FinalizationCoordinationRepository,
    private auditRepo: CoreFinalizationAuditRepository,
    private eventBus: CoreFinalizationEventBus,
  ) {}

  async upsertCoordination(params: UpsertFinalizationCoordinationParams): Promise<AtcFinalizationCoordination> {
    const record = await this.repo.upsert(params)
    await this.auditRepo.append({
      eventType: 'coordination_upserted',
      finalizationId: record.coordinationId,
      ownerServerId: record.ownerServerId,
      auditData: { coordinationType: record.coordinationType },
    })
    this.eventBus.emit('atc:core-finalization-runtime:coordination:upserted', {
      coordinationId: record.coordinationId,
    }).catch(() => undefined)
    return record
  }

  async progressCoordination(id: string): Promise<AtcFinalizationCoordination> {
    const record = await this.repo.updateStatus(id, 'completing')
    await this.auditRepo.append({
      eventType: 'coordination_completing',
      finalizationId: record.coordinationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:core-finalization-runtime:coordination:completing', {
      coordinationId: record.coordinationId,
    }).catch(() => undefined)
    return record
  }

  async completeCoordination(id: string): Promise<AtcFinalizationCoordination> {
    const record = await this.repo.updateStatus(id, 'completed')
    await this.auditRepo.append({
      eventType: 'coordination_completed',
      finalizationId: record.coordinationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:core-finalization-runtime:coordination:completed', {
      coordinationId: record.coordinationId,
    }).catch(() => undefined)
    return record
  }

  async getCoordination(coordinationId: string): Promise<AtcFinalizationCoordination | null> {
    return this.repo.findByCoordinationId(coordinationId)
  }
}
