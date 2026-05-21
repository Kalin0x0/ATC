import type { LongtermRecoveryRepository, AtcLongtermRecovery, CreateLongtermRecoveryParams } from './longterm-recovery.repository.js'
import type { PersistenceAuditRepository } from './persistence-audit.repository.js'
import type { PersistenceRuntimeEventBus } from './persistence-consistency.service.js'

export class LongTermRecoveryService {
  constructor(
    private recoveryRepo: LongtermRecoveryRepository,
    private auditRepo: PersistenceAuditRepository,
    private eventBus: PersistenceRuntimeEventBus,
  ) {}

  async startRecovery(params: CreateLongtermRecoveryParams): Promise<AtcLongtermRecovery> {
    const recovery = await this.recoveryRepo.create(params)
    await this.auditRepo.append({ eventType: 'recovery_started', auditData: { recoveryId: recovery.recoveryId } })
    this.eventBus.emit('atc:persistence:recovery:started', { recoveryId: recovery.recoveryId }).catch(() => undefined)
    return recovery
  }

  async completeRecovery(id: string): Promise<AtcLongtermRecovery> {
    const recovery = await this.recoveryRepo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({ eventType: 'recovery_completed', auditData: { recoveryId: recovery.recoveryId } })
    this.eventBus.emit('atc:persistence:recovery:completed', { recoveryId: recovery.recoveryId }).catch(() => undefined)
    return recovery
  }

  async failRecovery(id: string): Promise<AtcLongtermRecovery> {
    const recovery = await this.recoveryRepo.updateStatus(id, 'failed')
    this.eventBus.emit('atc:persistence:recovery:failed', { recoveryId: recovery.recoveryId }).catch(() => undefined)
    return recovery
  }

  async getRecovery(id: string): Promise<AtcLongtermRecovery | null> {
    return this.recoveryRepo.findById(id)
  }
}
