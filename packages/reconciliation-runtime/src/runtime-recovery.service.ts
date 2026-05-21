import type { RuntimeRecoveryRepository } from './runtime-recovery.repository.js'
import type { CreateRecoveryParams, AtcRuntimeRecovery } from './runtime-recovery.repository.js'
import type { RuntimeConsistencyAuditRepository } from './runtime-consistency-audit.repository.js'
import type { ReconciliationEventBus } from './runtime-migration.service.js'

export class RuntimeRecoveryService {
  constructor(
    private readonly recoveryRepo: RuntimeRecoveryRepository,
    private readonly auditRepo: RuntimeConsistencyAuditRepository,
    private readonly eventBus?: ReconciliationEventBus | undefined
  ) {}

  async startRecovery(params: CreateRecoveryParams): Promise<AtcRuntimeRecovery> {
    const recovery = await this.recoveryRepo.create(params)
    await this.auditRepo.record(
      recovery.recoveryId,
      'recovery:started',
      recovery.targetServerId ?? undefined,
      { entityId: recovery.entityId, recoveryType: recovery.recoveryType }
    )
    this.eventBus
      ?.emit('atc:reconciliation:recovery:started', {
        recoveryId: recovery.recoveryId,
        entityId: recovery.entityId,
        recoveryType: recovery.recoveryType,
        targetServerId: recovery.targetServerId,
      })
      .catch(() => undefined)
    return recovery
  }

  async completeRecovery(recoveryId: string): Promise<AtcRuntimeRecovery> {
    const recovery = await this.recoveryRepo.complete(recoveryId)
    this.eventBus
      ?.emit('atc:reconciliation:recovery:completed', {
        recoveryId: recovery.recoveryId,
        entityId: recovery.entityId,
        recoveryType: recovery.recoveryType,
      })
      .catch(() => undefined)
    return recovery
  }

  async failRecovery(recoveryId: string): Promise<AtcRuntimeRecovery> {
    return this.recoveryRepo.fail(recoveryId)
  }

  async listActiveRecoveries(): Promise<AtcRuntimeRecovery[]> {
    return this.recoveryRepo.listActive()
  }
}
