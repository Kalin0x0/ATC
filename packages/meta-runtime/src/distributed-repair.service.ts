import type { DistributedRepairRepository, AtcDistributedRepair, AtcRepairType } from './distributed-repair.repository.js'
import type { MetaAuditRepository } from './meta-audit.repository.js'
import type { MetaRuntimeEventBus } from './self-healing-recovery.service.js'

export interface StartRepairParams {
  repairType: AtcRepairType
  ownerServerId: string
  targetNode: string
  repairNonce: string
  repairData?: Record<string, unknown> | undefined
}

export class DistributedRepairService {
  constructor(
    private readonly repairRepo: DistributedRepairRepository,
    private readonly auditRepo: MetaAuditRepository,
    private readonly eventBus: MetaRuntimeEventBus,
  ) {}

  async startRepair(params: StartRepairParams): Promise<AtcDistributedRepair> {
    const repair = await this.repairRepo.create(params)
    await this.auditRepo.append({
      eventType: 'repair_started',
      ownerServerId: repair.ownerServerId,
      auditData: { repairId: repair.repairId, repairType: repair.repairType, targetNode: repair.targetNode },
    })
    this.eventBus.emit('atc:meta:repair:started', { id: repair.id, repairId: repair.repairId, targetNode: repair.targetNode }).catch(() => undefined)
    return repair
  }

  async completeRepair(id: string): Promise<AtcDistributedRepair> {
    const repair = await this.repairRepo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({
      eventType: 'repair_completed',
      ownerServerId: repair.ownerServerId,
      auditData: { repairId: repair.repairId, completedAt: repair.completedAt },
    })
    this.eventBus.emit('atc:meta:repair:completed', { id: repair.id, repairId: repair.repairId }).catch(() => undefined)
    return repair
  }

  async failRepair(id: string): Promise<AtcDistributedRepair> {
    return this.repairRepo.updateStatus(id, 'failed')
  }

  async getRepair(id: string): Promise<AtcDistributedRepair | null> {
    return this.repairRepo.findById(id)
  }
}
