import type {
  SovereigntyCoordinationRepository,
  AtcSovereigntyCoordination,
  UpsertSovereigntyCoordinationParams,
} from './sovereignty-coordination.repository.js'
import type { SovereigntyAuditRepository } from './sovereignty-audit.repository.js'
import type { SovereigntyRuntimeEventBus } from './sovereignty-recovery.service.js'

export class DistributedSovereigntyCoordinator {
  constructor(
    private repo: SovereigntyCoordinationRepository,
    private auditRepo: SovereigntyAuditRepository,
    private eventBus: SovereigntyRuntimeEventBus,
  ) {}

  async upsertCoordination(params: UpsertSovereigntyCoordinationParams): Promise<AtcSovereigntyCoordination> {
    const record = await this.repo.upsert(params)
    await this.auditRepo.append({
      eventType: 'coordination_upserted',
      sovereigntyId: record.coordinationId,
      ownerServerId: record.ownerServerId,
      auditData: { coordinationType: record.coordinationType },
    })
    this.eventBus.emit('atc:runtime-sovereignty:coordination:upserted', { coordinationId: record.coordinationId }).catch(() => undefined)
    return record
  }

  async suspendCoordination(id: string): Promise<AtcSovereigntyCoordination> {
    const record = await this.repo.updateStatus(id, 'suspended')
    await this.auditRepo.append({
      eventType: 'coordination_suspended',
      sovereigntyId: record.coordinationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:coordination:suspended', { coordinationId: record.coordinationId }).catch(() => undefined)
    return record
  }

  async expireCoordination(id: string): Promise<AtcSovereigntyCoordination> {
    const record = await this.repo.updateStatus(id, 'expired')
    await this.auditRepo.append({
      eventType: 'coordination_expired',
      sovereigntyId: record.coordinationId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:coordination:expired', { coordinationId: record.coordinationId }).catch(() => undefined)
    return record
  }

  async getCoordination(coordinationId: string): Promise<AtcSovereigntyCoordination | null> {
    return this.repo.findByCoordinationId(coordinationId)
  }
}
