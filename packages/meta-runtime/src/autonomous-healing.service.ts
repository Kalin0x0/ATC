import type { HealingOperationRepository, AtcHealingOperation, AtcHealingType } from './healing-operation.repository.js'
import type { MetaAuditRepository } from './meta-audit.repository.js'
import type { MetaRuntimeEventBus } from './self-healing-recovery.service.js'

export interface StartHealingParams {
  healingType: AtcHealingType
  ownerServerId: string
  targetNode: string
  healingNonce: string
  healingData?: Record<string, unknown> | undefined
}

export class AutonomousHealingService {
  constructor(
    private readonly healingRepo: HealingOperationRepository,
    private readonly auditRepo: MetaAuditRepository,
    private readonly eventBus: MetaRuntimeEventBus,
  ) {}

  async startHealing(params: StartHealingParams): Promise<AtcHealingOperation> {
    const healing = await this.healingRepo.create(params)
    await this.auditRepo.append({
      eventType: 'healing_started',
      ownerServerId: healing.ownerServerId,
      auditData: { healingId: healing.healingId, healingType: healing.healingType, targetNode: healing.targetNode },
    })
    this.eventBus.emit('atc:meta:healing:started', { id: healing.id, healingId: healing.healingId, targetNode: healing.targetNode }).catch(() => undefined)
    return healing
  }

  async completeHealing(id: string): Promise<AtcHealingOperation> {
    const healing = await this.healingRepo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({
      eventType: 'healing_completed',
      ownerServerId: healing.ownerServerId,
      auditData: { healingId: healing.healingId, completedAt: healing.completedAt },
    })
    this.eventBus.emit('atc:meta:healing:completed', { id: healing.id, healingId: healing.healingId }).catch(() => undefined)
    return healing
  }

  async failHealing(id: string): Promise<AtcHealingOperation> {
    return this.healingRepo.updateStatus(id, 'failed')
  }

  async getHealing(id: string): Promise<AtcHealingOperation | null> {
    return this.healingRepo.findById(id)
  }
}
