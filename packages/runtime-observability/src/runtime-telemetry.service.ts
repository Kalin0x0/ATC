import type { TraceRuntimeRepository, AtcRuntimeTrace, CreateTraceParams } from './trace-runtime.repository.js'
import type { ObservabilityAuditRepository } from './observability-audit.repository.js'
import type { RuntimeObservabilityEventBus } from './trace-recovery.service.js'

export class RuntimeTelemetryService {
  constructor(
    private traceRepo: TraceRuntimeRepository,
    private auditRepo: ObservabilityAuditRepository,
    private eventBus: RuntimeObservabilityEventBus,
  ) {}

  async startTrace(params: CreateTraceParams): Promise<AtcRuntimeTrace> {
    const trace = await this.traceRepo.create(params)
    await this.auditRepo.append({ traceId: trace.traceId, eventType: 'trace_started' })
    this.eventBus.emit('atc:observability:trace:started', { traceId: trace.traceId }).catch(() => undefined)
    return trace
  }

  async endTrace(id: string): Promise<AtcRuntimeTrace> {
    const trace = await this.traceRepo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({ traceId: trace.traceId, eventType: 'trace_completed' })
    this.eventBus.emit('atc:observability:trace:completed', { traceId: trace.traceId }).catch(() => undefined)
    return trace
  }

  async failTrace(id: string): Promise<AtcRuntimeTrace> {
    const trace = await this.traceRepo.updateStatus(id, 'failed')
    this.eventBus.emit('atc:observability:trace:failed', { traceId: trace.traceId }).catch(() => undefined)
    return trace
  }

  async getTrace(id: string): Promise<AtcRuntimeTrace | null> {
    return this.traceRepo.findById(id)
  }

  async listActiveTraces(ownerServerId?: string): Promise<AtcRuntimeTrace[]> {
    return this.traceRepo.listActive(ownerServerId)
  }
}
