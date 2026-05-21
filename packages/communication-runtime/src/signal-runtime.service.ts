import type { AtcEventBus } from '@atc/events'
import type { SignalRuntimeRepository } from './signal-runtime.repository.js'
import type { CommunicationAuditRepository } from './communication-audit.repository.js'
import type {
  AtcSignalRuntime,
  AtcSignalType,
  AtcSignalStatus,
} from './signal-runtime.repository.js'

export class SignalRuntimeService {
  constructor(
    private readonly signalRepo: SignalRuntimeRepository,
    private readonly auditRepo: CommunicationAuditRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async upsertSignal(params: {
    signalId: string
    channelId?: string
    signalType: AtcSignalType
    strength: number
    status?: AtcSignalStatus
    originZoneId?: string
    ownerServerId: string
  }): Promise<AtcSignalRuntime> {
    const signal = await this.signalRepo.upsert(params)

    this.eventBus
      .emit('atc:comms:signal:updated', {
        signalId: signal.signalId,
        status: signal.status,
      })
      .catch(() => undefined)

    return signal
  }

  async degradeSignal(signalId: string): Promise<AtcSignalRuntime> {
    const signal = await this.signalRepo.updateStatus(signalId, 'degraded')

    this.eventBus
      .emit('atc:comms:signal:degraded', { signalId })
      .catch(() => undefined)

    return signal
  }

  async loseSignal(signalId: string): Promise<AtcSignalRuntime> {
    const signal = await this.signalRepo.updateStatus(signalId, 'lost')

    this.eventBus
      .emit('atc:comms:signal:lost', { signalId })
      .catch(() => undefined)

    return signal
  }

  async reconcileStale(thresholdMs: number): Promise<number> {
    const staleSignals = await this.signalRepo.listStale(thresholdMs)

    for (const signal of staleSignals) {
      await this.signalRepo.deleteById(signal.signalId)
    }

    return staleSignals.length
  }
}
