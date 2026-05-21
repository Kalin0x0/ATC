import type { NodeTransferRepository } from './node-transfer.repository.js'
import type { CreateNodeTransferParams, AtcNodeTransfer } from './node-transfer.repository.js'
import type { RuntimeConsistencyAuditRepository } from './runtime-consistency-audit.repository.js'
import type { ReconciliationEventBus } from './runtime-migration.service.js'

export class OwnershipTransferService {
  constructor(
    private readonly transferRepo: NodeTransferRepository,
    private readonly auditRepo: RuntimeConsistencyAuditRepository,
    private readonly eventBus?: ReconciliationEventBus | undefined
  ) {}

  async initiateTransfer(params: CreateNodeTransferParams): Promise<AtcNodeTransfer> {
    const transfer = await this.transferRepo.create(params)
    await this.auditRepo.record(
      transfer.transferId,
      'transfer:initiated',
      transfer.fromServerId,
      { entityId: transfer.entityId, toServerId: transfer.toServerId }
    )
    this.eventBus
      ?.emit('atc:reconciliation:transfer:initiated', {
        transferId: transfer.transferId,
        entityId: transfer.entityId,
        fromServerId: transfer.fromServerId,
        toServerId: transfer.toServerId,
      })
      .catch(() => undefined)
    return transfer
  }

  async completeTransfer(transferId: string): Promise<AtcNodeTransfer> {
    const transfer = await this.transferRepo.transition(transferId, 'completed')
    this.eventBus
      ?.emit('atc:reconciliation:transfer:completed', {
        transferId: transfer.transferId,
        entityId: transfer.entityId,
        fromServerId: transfer.fromServerId,
        toServerId: transfer.toServerId,
      })
      .catch(() => undefined)
    return transfer
  }

  async failTransfer(transferId: string): Promise<AtcNodeTransfer> {
    return this.transferRepo.transition(transferId, 'failed')
  }
}
