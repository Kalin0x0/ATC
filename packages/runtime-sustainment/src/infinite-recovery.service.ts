import type {
  InfiniteRecoveryRepository,
  AtcInfiniteRecovery,
  InitiateRecoveryParams,
} from './infinite-recovery.repository.js'
import type { SustainmentAuditRepository } from './sustainment-audit.repository.js'
import type { RuntimeSustainmentEventBus } from './runtime-sustainment.service.js'

export class InfiniteRecoveryCoordinator {
  constructor(
    private readonly repo: InfiniteRecoveryRepository,
    private readonly audit: SustainmentAuditRepository,
    private readonly bus: RuntimeSustainmentEventBus
  ) {}

  async initiateRecovery(params: InitiateRecoveryParams): Promise<AtcInfiniteRecovery> {
    const record = await this.repo.upsert(params)
    await this.audit.append(record.id, 'recovery_initiated', { recoveryId: record.recoveryId })
    this.bus.emit('recovery.initiated', { recoveryId: record.recoveryId }).catch(() => undefined)
    return record
  }

  async beginRecovering(recoveryId: string): Promise<AtcInfiniteRecovery> {
    const record = await this.repo.updateStatus(recoveryId, 'recovering')
    await this.audit.append(record.id, 'recovery_recovering', { recoveryId: record.recoveryId })
    this.bus.emit('recovery.recovering', { recoveryId: record.recoveryId }).catch(() => undefined)
    return record
  }

  async completeRecovery(recoveryId: string): Promise<AtcInfiniteRecovery> {
    const record = await this.repo.updateStatus(recoveryId, 'completed', new Date())
    await this.audit.append(record.id, 'recovery_completed', { recoveryId: record.recoveryId })
    this.bus.emit('infinite_recovery_completed', { recoveryId: record.recoveryId }).catch(() => undefined)
    return record
  }

  async failRecovery(recoveryId: string): Promise<AtcInfiniteRecovery> {
    const record = await this.repo.updateStatus(recoveryId, 'failed')
    await this.audit.append(record.id, 'recovery_failed', { recoveryId: record.recoveryId })
    this.bus.emit('recovery.failed', { recoveryId: record.recoveryId }).catch(() => undefined)
    return record
  }

  async getRecovery(recoveryId: string): Promise<AtcInfiniteRecovery | null> {
    return this.repo.findByRecoveryId(recoveryId)
  }
}
