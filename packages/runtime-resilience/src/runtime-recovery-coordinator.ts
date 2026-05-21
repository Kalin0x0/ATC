import type { RecoveryOperationRepository, AtcRecoveryOperation, CreateRecoveryOperationParams } from './recovery-operation.repository.js'
import type { RecoverySnapshotRepository } from './recovery-snapshot.repository.js'
import type { FailoverAuditRepository } from './failover-audit.repository.js'

export interface RuntimeResilienceEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export class RuntimeRecoveryCoordinator {
  constructor(
    private recoveryOpRepo: RecoveryOperationRepository,
    private snapshotRepo: RecoverySnapshotRepository,
    private auditRepo: FailoverAuditRepository,
    private eventBus: RuntimeResilienceEventBus,
  ) {}

  async initiateRecovery(params: CreateRecoveryOperationParams): Promise<AtcRecoveryOperation> {
    const op = await this.recoveryOpRepo.create(params)
    await this.auditRepo.append({ eventType: 'recovery_started', auditData: { operationId: op.operationId } })
    this.eventBus.emit('atc:resilience:recovery:started', { operationId: op.operationId }).catch(() => undefined)
    return op
  }

  async completeRecovery(id: string): Promise<AtcRecoveryOperation> {
    const op = await this.recoveryOpRepo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({ eventType: 'recovery_completed', auditData: { operationId: op.operationId } })
    this.eventBus.emit('atc:resilience:recovery:completed', { operationId: op.operationId }).catch(() => undefined)
    return op
  }

  async failRecovery(id: string): Promise<AtcRecoveryOperation> {
    const op = await this.recoveryOpRepo.updateStatus(id, 'failed')
    this.eventBus.emit('atc:resilience:recovery:failed', { operationId: op.operationId }).catch(() => undefined)
    return op
  }

  async getOperation(id: string): Promise<AtcRecoveryOperation | null> {
    return this.recoveryOpRepo.findById(id)
  }

  async listActiveOperations(ownerServerId?: string): Promise<AtcRecoveryOperation[]> {
    return this.recoveryOpRepo.listActive(ownerServerId)
  }
}
