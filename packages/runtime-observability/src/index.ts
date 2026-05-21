// Pool
export type { PoolConnection, RuntimeObservabilityPool } from './pool.js'

// ID generator
export { generateId } from './id.js'

// Errors
export {
  RuntimeObservabilityError,
  TraceNotFoundError,
  DuplicateTraceError,
  CorrelationNotFoundError,
  DiagnosticNotFoundError,
} from './errors.js'

// Trace Runtime Repository
export type {
  AtcTraceType,
  AtcTraceStatus,
  AtcRuntimeTrace,
  CreateTraceParams,
} from './trace-runtime.repository.js'
export { TraceRuntimeRepository } from './trace-runtime.repository.js'

// Runtime Metrics Repository
export type {
  AtcRuntimeMetric,
  RecordMetricParams,
} from './runtime-metrics.repository.js'
export { RuntimeMetricsRepository } from './runtime-metrics.repository.js'

// Failure Correlation Repository
export type {
  AtcFailureType,
  AtcCorrelationStatus,
  AtcFailureCorrelation,
  CreateCorrelationParams,
} from './failure-correlation.repository.js'
export { FailureCorrelationRepository } from './failure-correlation.repository.js'

// Runtime Diagnostics Repository
export type {
  AtcDiagnosticType,
  AtcDiagnosticStatus,
  AtcRuntimeDiagnostic,
  CreateDiagnosticParams,
} from './runtime-diagnostics.repository.js'
export { RuntimeDiagnosticsRepository } from './runtime-diagnostics.repository.js'

// Trace Runtime State Repository
export type {
  AtcTraceLevel,
  AtcTraceRuntimeState,
  UpsertTraceStateParams,
} from './trace-runtime-state.repository.js'
export { TraceRuntimeStateRepository } from './trace-runtime-state.repository.js'

// Observability Audit Repository
export type { AtcObservabilityAuditEntry, AppendObservabilityAuditParams } from './observability-audit.repository.js'
export { ObservabilityAuditRepository } from './observability-audit.repository.js'

// Services
export type { RuntimeObservabilityEventBus } from './trace-recovery.service.js'
export { RuntimeTelemetryService } from './runtime-telemetry.service.js'
export { DistributedTracingService } from './distributed-tracing.service.js'
export { RuntimeMetricsService } from './runtime-metrics.service.js'
export { FailureCorrelationService } from './failure-correlation.service.js'
export { RuntimeDiagnosticsService } from './runtime-diagnostics.service.js'
export { TraceRecoveryService } from './trace-recovery.service.js'
