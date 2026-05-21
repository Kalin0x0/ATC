import type { MetaAllocationRepository, AtcMetaAllocation, AtcAllocationType } from './meta-allocation.repository.js'
import type { MetaAuditRepository } from './meta-audit.repository.js'
import type { MetaRuntimeEventBus } from './self-healing-recovery.service.js'

export interface AllocateParams {
  entityId: string
  allocationType: AtcAllocationType
  ownerServerId: string
  allocationData?: Record<string, unknown> | undefined
}

export class MetaAllocationService {
  constructor(
    private readonly allocationRepo: MetaAllocationRepository,
    private readonly auditRepo: MetaAuditRepository,
    private readonly eventBus: MetaRuntimeEventBus,
  ) {}

  async allocate(params: AllocateParams): Promise<AtcMetaAllocation> {
    const allocation = await this.allocationRepo.upsert(params)
    this.eventBus.emit('atc:meta:allocated', { entityId: allocation.entityId, allocationType: allocation.allocationType }).catch(() => undefined)
    return allocation
  }

  async release(entityId: string): Promise<void> {
    await this.allocationRepo.release(entityId)
    this.eventBus.emit('atc:meta:released', { entityId }).catch(() => undefined)
  }

  async getAllocation(entityId: string): Promise<AtcMetaAllocation | null> {
    return this.allocationRepo.findByEntity(entityId)
  }
}
