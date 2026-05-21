import type { DistributedLockRepository, AtcDistributedLock, AtcLockType } from './distributed-lock.repository.js'
import type { IntegrityAuditRepository } from './integrity-audit.repository.js'
import type { WorldIntegrityEventBus } from './integrity-recovery.service.js'

export interface AcquireLockServiceParams {
  resourceKey: string
  lockType: AtcLockType
  ownerServerId: string
  lockNonce: string
  expiresAt?: Date | null | undefined
  lockData?: Record<string, unknown> | undefined
}

export class DistributedLockingService {
  constructor(
    private lockRepo: DistributedLockRepository,
    private auditRepo: IntegrityAuditRepository,
    private eventBus: WorldIntegrityEventBus,
  ) {}

  async acquireLock(params: AcquireLockServiceParams): Promise<AtcDistributedLock> {
    const lock = await this.lockRepo.upsert({
      resourceKey: params.resourceKey,
      lockType: params.lockType,
      ownerServerId: params.ownerServerId,
      lockNonce: params.lockNonce,
      expiresAt: params.expiresAt,
      lockData: params.lockData,
    })
    await this.auditRepo.append({
      eventType: 'lock_acquired',
      resourceKey: lock.resourceKey,
      ownerServerId: lock.ownerServerId,
      auditData: { lockType: lock.lockType },
    })
    this.eventBus.emit('atc:world-integrity:lock:acquired', { resourceKey: lock.resourceKey }).catch(() => undefined)
    return lock
  }

  async releaseLock(resourceKey: string): Promise<AtcDistributedLock> {
    const lock = await this.lockRepo.releaseLock(resourceKey)
    await this.auditRepo.append({
      eventType: 'lock_released',
      resourceKey: lock.resourceKey,
      ownerServerId: lock.ownerServerId,
    })
    this.eventBus.emit('atc:world-integrity:lock:released', { resourceKey: lock.resourceKey }).catch(() => undefined)
    return lock
  }

  async getLock(resourceKey: string): Promise<AtcDistributedLock | null> {
    return this.lockRepo.findByResourceKey(resourceKey)
  }
}
