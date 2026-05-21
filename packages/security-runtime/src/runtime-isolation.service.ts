import type { RuntimeIsolationRepository, AtcRuntimeIsolation, IsolateEntityParams } from './runtime-isolation.repository.js'
import type { SecurityAuditRepository } from './security-audit.repository.js'
import type { SecurityRuntimeEventBus } from './runtime-security-recovery.service.js'

export class RuntimeIsolationService {
  constructor(
    private isolationRepo: RuntimeIsolationRepository,
    private auditRepo: SecurityAuditRepository,
    private eventBus: SecurityRuntimeEventBus,
  ) {}

  async isolateEntity(params: IsolateEntityParams): Promise<AtcRuntimeIsolation> {
    const isolation = await this.isolationRepo.upsert(params)
    await this.auditRepo.append({
      eventType: 'entity_isolated',
      entityId: isolation.entityId,
      ownerServerId: isolation.ownerServerId,
      auditData: { isolationId: isolation.id, isolationType: isolation.isolationType },
    })
    this.eventBus.emit('atc:security:isolation:applied', isolation).catch(() => undefined)
    return isolation
  }

  async releaseIsolation(entityId: string): Promise<void> {
    await this.isolationRepo.release(entityId)
    await this.auditRepo.append({
      eventType: 'isolation_released',
      entityId,
      auditData: { entityId },
    })
    this.eventBus.emit('atc:security:isolation:released', { entityId }).catch(() => undefined)
  }

  async getIsolation(entityId: string): Promise<AtcRuntimeIsolation | null> {
    return this.isolationRepo.findByEntity(entityId)
  }
}
