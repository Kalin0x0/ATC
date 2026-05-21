import type { DeterministicClosureRepository, AtcDeterministicClosure, AtcClosureType } from './deterministic-closure.repository.js'
import type { LockdownAuditRepository } from './lockdown-audit.repository.js'
import type { RuntimeLockdownEventBus } from './lockdown-recovery.service.js'

export interface StartClosureParams {
  closureType: AtcClosureType
  ownerServerId: string
  closureNonce: string
  closureData?: Record<string, unknown> | undefined
}

export class DeterministicClosureService {
  constructor(
    private repo: DeterministicClosureRepository,
    private auditRepo: LockdownAuditRepository,
    private eventBus: RuntimeLockdownEventBus,
  ) {}

  async startClosure(params: StartClosureParams): Promise<AtcDeterministicClosure> {
    const record = await this.repo.create({
      closureType: params.closureType,
      ownerServerId: params.ownerServerId,
      closureNonce: params.closureNonce,
      closureData: params.closureData,
    })
    await this.auditRepo.append({
      eventType: 'closure_started',
      ownerServerId: record.ownerServerId,
      auditData: { closureId: record.closureId, closureType: record.closureType },
    })
    this.eventBus.emit('atc:lockdown:closure:started', { closureId: record.closureId }).catch(() => undefined)
    return record
  }

  async progressClosure(id: string): Promise<AtcDeterministicClosure> {
    const record = await this.repo.updateStatus(id, 'in_progress')
    await this.auditRepo.append({
      eventType: 'closure_in_progress',
      ownerServerId: record.ownerServerId,
      auditData: { closureId: record.closureId },
    })
    this.eventBus.emit('atc:lockdown:closure:in_progress', { closureId: record.closureId }).catch(() => undefined)
    return record
  }

  async completeClosure(id: string): Promise<AtcDeterministicClosure> {
    const record = await this.repo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({
      eventType: 'closure_completed',
      ownerServerId: record.ownerServerId,
      auditData: { closureId: record.closureId },
    })
    this.eventBus.emit('atc:lockdown:closure:completed', { closureId: record.closureId }).catch(() => undefined)
    return record
  }

  async abortClosure(id: string): Promise<AtcDeterministicClosure> {
    const record = await this.repo.updateStatus(id, 'aborted')
    await this.auditRepo.append({
      eventType: 'closure_aborted',
      ownerServerId: record.ownerServerId,
      auditData: { closureId: record.closureId },
    })
    this.eventBus.emit('atc:lockdown:closure:aborted', { closureId: record.closureId }).catch(() => undefined)
    return record
  }

  async getClosure(id: string): Promise<AtcDeterministicClosure | null> {
    return this.repo.findById(id)
  }
}
