import type { RuntimeLockdownRepository, AtcRuntimeLockdown, AtcLockdownType } from './runtime-lockdown.repository.js'
import type { LockdownAuditRepository } from './lockdown-audit.repository.js'
import type { RuntimeLockdownEventBus } from './lockdown-recovery.service.js'

export interface InitiateLockdownParams {
  lockdownType: AtcLockdownType
  ownerServerId: string
  lockdownNonce: string
  lockdownData?: Record<string, unknown> | undefined
}

export class RuntimeLockdownService {
  constructor(
    private repo: RuntimeLockdownRepository,
    private auditRepo: LockdownAuditRepository,
    private eventBus: RuntimeLockdownEventBus,
  ) {}

  async initiateLockdown(params: InitiateLockdownParams): Promise<AtcRuntimeLockdown> {
    const record = await this.repo.create({
      lockdownType: params.lockdownType,
      ownerServerId: params.ownerServerId,
      lockdownNonce: params.lockdownNonce,
      lockdownData: params.lockdownData,
    })
    await this.auditRepo.append({
      eventType: 'lockdown_initiated',
      lockdownId: record.lockdownId,
      ownerServerId: record.ownerServerId,
      auditData: { lockdownType: record.lockdownType },
    })
    this.eventBus.emit('atc:lockdown:lockdown:initiated', { lockdownId: record.lockdownId }).catch(() => undefined)
    return record
  }

  async activateLockdown(id: string): Promise<AtcRuntimeLockdown> {
    const record = await this.repo.updateStatus(id, 'active')
    await this.auditRepo.append({
      eventType: 'lockdown_activated',
      lockdownId: record.lockdownId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:lockdown:lockdown:activated', { lockdownId: record.lockdownId }).catch(() => undefined)
    return record
  }

  async beginLifting(id: string): Promise<AtcRuntimeLockdown> {
    const record = await this.repo.updateStatus(id, 'lifting')
    await this.auditRepo.append({
      eventType: 'lockdown_lifting',
      lockdownId: record.lockdownId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:lockdown:lockdown:lifting', { lockdownId: record.lockdownId }).catch(() => undefined)
    return record
  }

  async liftLockdown(id: string): Promise<AtcRuntimeLockdown> {
    const record = await this.repo.updateStatus(id, 'lifted', new Date())
    await this.auditRepo.append({
      eventType: 'lockdown_lifted',
      lockdownId: record.lockdownId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:lockdown:lockdown:lifted', { lockdownId: record.lockdownId }).catch(() => undefined)
    return record
  }

  async failLockdown(id: string): Promise<AtcRuntimeLockdown> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.auditRepo.append({
      eventType: 'lockdown_failed',
      lockdownId: record.lockdownId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:lockdown:lockdown:failed', { lockdownId: record.lockdownId }).catch(() => undefined)
    return record
  }

  async getLockdown(id: string): Promise<AtcRuntimeLockdown | null> {
    return this.repo.findById(id)
  }
}
