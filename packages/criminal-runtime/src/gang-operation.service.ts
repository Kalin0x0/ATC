import type { AtcCriminalOperation, AtcOperationType } from '@atc/shared-types'
import { ATC_CRIMINAL_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { CriminalOperationRepository } from './criminal-operation.repository.js'
export interface GangOperationDeps {
  operationRepo: CriminalOperationRepository
  eventBus: AtcEventBus | undefined
}

export interface CreateOperationServiceParams {
  label: string
  operationType: AtcOperationType
  ownerPrincipalId: string
  gangId?: string | null | undefined
  metadata?: Record<string, unknown> | null | undefined
}

export class GangOperationService {
  private readonly operationRepo: CriminalOperationRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: GangOperationDeps) {
    this.operationRepo = deps.operationRepo
    this.eventBus      = deps.eventBus
  }

  async createOperation(params: CreateOperationServiceParams): Promise<AtcCriminalOperation> {
    return this.operationRepo.create({
      label: params.label,
      operationType: params.operationType,
      ownerPrincipalId: params.ownerPrincipalId,
      gangId: params.gangId,
      metadata: params.metadata,
    })
  }

  async startOperation(operationId: string): Promise<AtcCriminalOperation> {
    const op = await this.operationRepo.transition(operationId, 'active')

    this.eventBus?.emit(ATC_CRIMINAL_EVENTS.OPERATION_STARTED, {
      operationId,
      label: op.label,
      operationType: op.operationType,
      gangId: op.gangId,
    }).catch(() => undefined)

    return op
  }

  async completeOperation(operationId: string, outcome?: string): Promise<AtcCriminalOperation> {
    const op = await this.operationRepo.transition(operationId, 'completed', { outcome })

    this.eventBus?.emit(ATC_CRIMINAL_EVENTS.OPERATION_COMPLETED, {
      operationId,
      status: 'completed',
      outcome: op.outcome,
    }).catch(() => undefined)

    return op
  }

  async failOperation(operationId: string, outcome?: string): Promise<AtcCriminalOperation> {
    const op = await this.operationRepo.transition(operationId, 'failed', { outcome })

    this.eventBus?.emit(ATC_CRIMINAL_EVENTS.OPERATION_COMPLETED, {
      operationId,
      status: 'failed',
      outcome: op.outcome,
    }).catch(() => undefined)

    return op
  }

  async abortOperation(operationId: string): Promise<AtcCriminalOperation> {
    const op = await this.operationRepo.transition(operationId, 'aborted')

    this.eventBus?.emit(ATC_CRIMINAL_EVENTS.OPERATION_ABORTED, {
      operationId,
    }).catch(() => undefined)

    return op
  }

  async getOperation(id: string): Promise<AtcCriminalOperation | null> {
    return this.operationRepo.findById(id)
  }

  async listByGang(gangId: string): Promise<AtcCriminalOperation[]> {
    return this.operationRepo.listByGang(gangId)
  }

  async listByOwner(principalId: string): Promise<AtcCriminalOperation[]> {
    return this.operationRepo.listByOwner(principalId)
  }
}
