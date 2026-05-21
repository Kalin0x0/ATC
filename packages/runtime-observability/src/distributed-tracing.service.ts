import type { TraceRuntimeStateRepository, AtcTraceRuntimeState, UpsertTraceStateParams } from './trace-runtime-state.repository.js'
import type { RuntimeObservabilityEventBus } from './trace-recovery.service.js'

export class DistributedTracingService {
  constructor(
    private stateRepo: TraceRuntimeStateRepository,
    private eventBus: RuntimeObservabilityEventBus,
  ) {}

  async upsertTraceState(params: UpsertTraceStateParams): Promise<AtcTraceRuntimeState> {
    const state = await this.stateRepo.upsert(params)
    this.eventBus.emit('atc:observability:trace_state:updated', { entityId: state.entityId, level: state.traceLevel }).catch(() => undefined)
    return state
  }

  async getTraceState(entityId: string): Promise<AtcTraceRuntimeState | null> {
    return this.stateRepo.findByEntity(entityId)
  }

  async clearTraceState(entityId: string): Promise<void> {
    await this.stateRepo.deactivate(entityId)
    this.eventBus.emit('atc:observability:trace_state:cleared', { entityId }).catch(() => undefined)
  }
}
