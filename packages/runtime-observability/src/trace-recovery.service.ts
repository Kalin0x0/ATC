import type { TraceRuntimeRepository } from './trace-runtime.repository.js'
import type { TraceRuntimeStateRepository } from './trace-runtime-state.repository.js'
import type { RuntimeMetricsRepository } from './runtime-metrics.repository.js'
import type { ObservabilityAuditRepository } from './observability-audit.repository.js'

export interface RuntimeObservabilityEventBus {
  emit(event: string, payload: unknown): Promise<void>
}

export class TraceRecoveryService {
  constructor(
    private traceRepo: TraceRuntimeRepository,
    private stateRepo: TraceRuntimeStateRepository,
    private metricsRepo: RuntimeMetricsRepository,
    private auditRepo: ObservabilityAuditRepository,
    private eventBus: RuntimeObservabilityEventBus,
  ) {}

  async cleanupStale(thresholdMs: number): Promise<{ traces: number; states: number; metrics: number }> {
    const [traces, states, metrics] = await Promise.all([
      this.traceRepo.cleanupStale(thresholdMs),
      this.stateRepo.cleanupExpired(),
      this.metricsRepo.cleanupOld(thresholdMs),
    ])
    await this.auditRepo.append({ eventType: 'cleanup_completed', auditData: { traces, states, metrics } })
    this.eventBus.emit('atc:observability:cleanup:completed', { traces, states, metrics }).catch(() => undefined)
    return { traces, states, metrics }
  }
}
