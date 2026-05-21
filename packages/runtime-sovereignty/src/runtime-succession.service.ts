import type {
  RuntimeSuccessionRepository,
  AtcRuntimeSuccession,
  CreateSuccessionParams,
} from './runtime-succession.repository.js'
import type { SovereigntyAuditRepository } from './sovereignty-audit.repository.js'
import type { SovereigntyRuntimeEventBus } from './sovereignty-recovery.service.js'

export class RuntimeSuccessionService {
  constructor(
    private repo: RuntimeSuccessionRepository,
    private auditRepo: SovereigntyAuditRepository,
    private eventBus: SovereigntyRuntimeEventBus,
  ) {}

  async initiateSuccession(params: CreateSuccessionParams): Promise<AtcRuntimeSuccession> {
    const record = await this.repo.create(params)
    await this.auditRepo.append({
      eventType: 'succession_initiated',
      sovereigntyId: record.successionId,
      ownerServerId: record.ownerServerId,
      auditData: { successionType: record.successionType },
    })
    this.eventBus.emit('atc:runtime-sovereignty:succession:initiated', { successionId: record.successionId }).catch(() => undefined)
    return record
  }

  async beginTransfer(id: string): Promise<AtcRuntimeSuccession> {
    const record = await this.repo.updateStatus(id, 'transferring')
    await this.auditRepo.append({
      eventType: 'succession_transferring',
      sovereigntyId: record.successionId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:succession:transferring', { successionId: record.successionId }).catch(() => undefined)
    return record
  }

  async completeSuccession(id: string): Promise<AtcRuntimeSuccession> {
    const record = await this.repo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({
      eventType: 'succession_completed',
      sovereigntyId: record.successionId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:succession:completed', { successionId: record.successionId }).catch(() => undefined)
    return record
  }

  async failSuccession(id: string): Promise<AtcRuntimeSuccession> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.auditRepo.append({
      eventType: 'succession_failed',
      sovereigntyId: record.successionId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:succession:failed', { successionId: record.successionId }).catch(() => undefined)
    return record
  }

  async revertSuccession(id: string): Promise<AtcRuntimeSuccession> {
    const record = await this.repo.updateStatus(id, 'reverted')
    await this.auditRepo.append({
      eventType: 'succession_reverted',
      sovereigntyId: record.successionId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:succession:reverted', { successionId: record.successionId }).catch(() => undefined)
    return record
  }

  async getSuccession(id: string): Promise<AtcRuntimeSuccession | null> {
    return this.repo.findById(id)
  }
}
