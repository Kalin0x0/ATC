import type { AtcEventBus } from '@atc/events'
import type {
  TrafficSignalRepository,
  AtcTrafficSignal,
  AtcSignalState,
} from './traffic-signal.repository.js'

export class TrafficSignalService {
  constructor(
    private readonly signalRepo: TrafficSignalRepository,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async updateSignal(
    signalId: string,
    signalName: string,
    state: AtcSignalState,
    changedByPrincipalId?: string | undefined,
  ): Promise<AtcTrafficSignal> {
    const signal = await this.signalRepo.upsertState(signalId, signalName, state, {
      ...(changedByPrincipalId !== undefined ? { changedByPrincipalId } : {}),
    })

    this.eventBus?.emit('atc:city:traffic_signal_changed', {
      signalId: signal.signalId,
      signalName: signal.signalName,
      state: signal.state,
      intersectionId: signal.intersectionId,
    }).catch(() => undefined)

    return signal
  }

  async getSignal(signalId: string): Promise<AtcTrafficSignal | null> {
    return this.signalRepo.findBySignalId(signalId)
  }

  async listAll(): Promise<AtcTrafficSignal[]> {
    return this.signalRepo.listAll()
  }
}
