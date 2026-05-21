import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RuntimeTelemetryService,
  DistributedTracingService,
  RuntimeMetricsService,
  FailureCorrelationService,
  RuntimeDiagnosticsService,
  TraceRecoveryService,
} from '@atc/runtime-observability'
import type {
  TraceRuntimeRepository,
  TraceRuntimeStateRepository,
  RuntimeMetricsRepository,
  FailureCorrelationRepository,
  RuntimeDiagnosticsRepository,
  ObservabilityAuditRepository,
  RuntimeObservabilityEventBus,
} from '@atc/runtime-observability'

const ULID       = '01JABCDEFGHJKMNPQRST'
const TRACE_ID   = 'TRACE_001'
const ENTITY_ID  = 'ENTITY_001'
const METRIC_ID  = 'METRIC_001'
const CORR_ID    = 'CORR_001'
const DIAG_ID    = 'DIAG_001'

function mockAudit(): ObservabilityAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as ObservabilityAuditRepository
}

function mockBus(): RuntimeObservabilityEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── RuntimeTelemetryService ──────────────────────────────────────────────────

describe('RuntimeTelemetryService', () => {
  let traceRepo: TraceRuntimeRepository
  let audit: ObservabilityAuditRepository
  let bus: RuntimeObservabilityEventBus
  let svc: RuntimeTelemetryService

  beforeEach(() => {
    const trace = {
      id: ULID, traceId: TRACE_ID, traceType: 'request' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      sourceNode: 'fivem-server', traceNonce: 'nonce-1',
      completedAt: null, createdAt: new Date(), updatedAt: new Date(), traceData: '{}',
    }
    traceRepo = {
      create:       vi.fn().mockResolvedValue(trace),
      findById:     vi.fn().mockResolvedValue(trace),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...trace, status, completedAt: completedAt ?? null })
      ),
      listActive:   vi.fn().mockResolvedValue([trace]),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as TraceRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeTelemetryService(traceRepo, audit, bus)
  })

  it('startTrace creates trace and emits event', async () => {
    const result = await svc.startTrace({
      traceId: TRACE_ID, traceType: 'request', ownerServerId: 'server-1',
      traceNonce: 'nonce-1',
    })
    expect(result.traceId).toBe(TRACE_ID)
    expect(vi.mocked(audit.append)).toHaveBeenCalledOnce()
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:observability:trace:started', expect.any(Object))
  })

  it('endTrace transitions to completed', async () => {
    const result = await svc.endTrace(ULID)
    expect(result.status).toBe('completed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:observability:trace:completed', expect.any(Object))
  })

  it('failTrace transitions to failed', async () => {
    const result = await svc.failTrace(ULID)
    expect(result.status).toBe('failed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:observability:trace:failed', expect.any(Object))
  })

  it('getTrace returns null for unknown id', async () => {
    vi.mocked(traceRepo.findById).mockResolvedValue(null)
    const result = await svc.getTrace('unknown')
    expect(result).toBeNull()
  })

  it('listActiveTraces returns traces', async () => {
    const results = await svc.listActiveTraces('server-1')
    expect(results).toHaveLength(1)
  })
})

// ── DistributedTracingService ────────────────────────────────────────────────

describe('DistributedTracingService', () => {
  let stateRepo: TraceRuntimeStateRepository
  let bus: RuntimeObservabilityEventBus
  let svc: DistributedTracingService

  beforeEach(() => {
    const state = {
      id: ULID, entityId: ENTITY_ID, traceLevel: 'info' as const,
      isActive: true, ownerServerId: 'server-1',
      expiresAt: null, createdAt: new Date(), updatedAt: new Date(), stateData: '{}',
    }
    stateRepo = {
      upsert:         vi.fn().mockResolvedValue(state),
      findByEntity:   vi.fn().mockResolvedValue(state),
      deactivate:     vi.fn().mockResolvedValue(undefined),
      cleanupExpired: vi.fn().mockResolvedValue(2),
    } as unknown as TraceRuntimeStateRepository
    bus = mockBus()
    svc = new DistributedTracingService(stateRepo, bus)
  })

  it('upsertTraceState persists state and emits event', async () => {
    const result = await svc.upsertTraceState({
      entityId: ENTITY_ID, traceLevel: 'info', ownerServerId: 'server-1',
    })
    expect(result.entityId).toBe(ENTITY_ID)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:observability:trace_state:updated', expect.any(Object))
  })

  it('getTraceState returns null for unknown entity', async () => {
    vi.mocked(stateRepo.findByEntity).mockResolvedValue(null)
    const result = await svc.getTraceState('unknown')
    expect(result).toBeNull()
  })

  it('clearTraceState deactivates and emits', async () => {
    await svc.clearTraceState(ENTITY_ID)
    expect(vi.mocked(stateRepo.deactivate)).toHaveBeenCalledWith(ENTITY_ID)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:observability:trace_state:cleared', expect.any(Object))
  })
})

// ── RuntimeMetricsService ────────────────────────────────────────────────────

describe('RuntimeMetricsService', () => {
  let metricsRepo: RuntimeMetricsRepository
  let audit: ObservabilityAuditRepository
  let bus: RuntimeObservabilityEventBus
  let svc: RuntimeMetricsService

  beforeEach(() => {
    const metric = {
      id: ULID, metricId: METRIC_ID, metricType: 'latency' as const,
      ownerServerId: 'server-1', entityId: ENTITY_ID, value: 42,
      createdAt: new Date(), metricData: '{}',
    }
    metricsRepo = {
      record:       vi.fn().mockResolvedValue(metric),
      listByEntity: vi.fn().mockResolvedValue([metric]),
      cleanupOld:   vi.fn().mockResolvedValue(5),
    } as unknown as RuntimeMetricsRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeMetricsService(metricsRepo, audit, bus)
  })

  it('recordMetric records and emits event', async () => {
    const result = await svc.recordMetric({
      metricType: 'latency', ownerServerId: 'server-1', value: 42, entityId: ENTITY_ID,
    })
    expect(result.metricType).toBe('latency')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:observability:metric:recorded', expect.any(Object))
  })

  it('getMetrics returns metrics list', async () => {
    const results = await svc.getMetrics(ENTITY_ID)
    expect(results).toHaveLength(1)
  })
})

// ── FailureCorrelationService ────────────────────────────────────────────────

describe('FailureCorrelationService', () => {
  let correlationRepo: FailureCorrelationRepository
  let audit: ObservabilityAuditRepository
  let bus: RuntimeObservabilityEventBus
  let svc: FailureCorrelationService

  beforeEach(() => {
    const correlation = {
      id: ULID, correlationId: CORR_ID, failureType: 'timeout' as const,
      status: 'open' as const, ownerServerId: 'server-1',
      sourceNode: 'fivem-server', resolvedAt: null,
      createdAt: new Date(), updatedAt: new Date(), correlationData: '{}',
    }
    correlationRepo = {
      create:    vi.fn().mockResolvedValue(correlation),
      findById:  vi.fn().mockResolvedValue(correlation),
      resolve:   vi.fn().mockResolvedValue({ ...correlation, status: 'resolved', resolvedAt: new Date() }),
      listOpen:  vi.fn().mockResolvedValue([correlation]),
    } as unknown as FailureCorrelationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new FailureCorrelationService(correlationRepo, audit, bus)
  })

  it('createCorrelation creates and emits event', async () => {
    const result = await svc.createCorrelation({
      failureType: 'timeout', ownerServerId: 'server-1', sourceNode: 'fivem-server',
    })
    expect(result.correlationId).toBe(CORR_ID)
    expect(vi.mocked(audit.append)).toHaveBeenCalledOnce()
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:observability:correlation:created', expect.any(Object))
  })

  it('resolveCorrelation transitions to resolved', async () => {
    const result = await svc.resolveCorrelation(ULID)
    expect(result.status).toBe('resolved')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:observability:correlation:resolved', expect.any(Object))
  })

  it('listOpenCorrelations returns list', async () => {
    const results = await svc.listOpenCorrelations('server-1')
    expect(results).toHaveLength(1)
  })
})

// ── RuntimeDiagnosticsService ────────────────────────────────────────────────

describe('RuntimeDiagnosticsService', () => {
  let diagnosticsRepo: RuntimeDiagnosticsRepository
  let audit: ObservabilityAuditRepository
  let bus: RuntimeObservabilityEventBus
  let svc: RuntimeDiagnosticsService

  beforeEach(() => {
    const diagnostic = {
      id: ULID, diagnosticId: DIAG_ID, diagnosticType: 'health' as const,
      status: 'running' as const, ownerServerId: 'server-1',
      entityId: ENTITY_ID, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(), diagnosticData: '{}',
    }
    diagnosticsRepo = {
      create:       vi.fn().mockResolvedValue(diagnostic),
      findById:     vi.fn().mockResolvedValue(diagnostic),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...diagnostic, status, completedAt: completedAt ?? null })
      ),
      listByEntity: vi.fn().mockResolvedValue([diagnostic]),
    } as unknown as RuntimeDiagnosticsRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeDiagnosticsService(diagnosticsRepo, audit, bus)
  })

  it('runDiagnostic creates diagnostic and emits event', async () => {
    const result = await svc.runDiagnostic({
      diagnosticType: 'health', ownerServerId: 'server-1', entityId: ENTITY_ID,
    })
    expect(result.diagnosticId).toBe(DIAG_ID)
    expect(vi.mocked(audit.append)).toHaveBeenCalledOnce()
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:observability:diagnostic:started', expect.any(Object))
  })

  it('completeDiagnostic transitions to passed', async () => {
    const result = await svc.completeDiagnostic(ULID)
    expect(result.status).toBe('passed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:observability:diagnostic:passed', expect.any(Object))
  })

  it('failDiagnostic transitions to failed', async () => {
    const result = await svc.failDiagnostic(ULID)
    expect(result.status).toBe('failed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:observability:diagnostic:failed', expect.any(Object))
  })

  it('getDiagnostics returns list for entity', async () => {
    const results = await svc.getDiagnostics(ENTITY_ID)
    expect(results).toHaveLength(1)
  })
})

// ── TraceRecoveryService ─────────────────────────────────────────────────────

describe('TraceRecoveryService', () => {
  let traceRepo: TraceRuntimeRepository
  let stateRepo: TraceRuntimeStateRepository
  let metricsRepo: RuntimeMetricsRepository
  let audit: ObservabilityAuditRepository
  let bus: RuntimeObservabilityEventBus
  let svc: TraceRecoveryService

  beforeEach(() => {
    traceRepo   = { cleanupStale:   vi.fn().mockResolvedValue(3) } as unknown as TraceRuntimeRepository
    stateRepo   = { cleanupExpired: vi.fn().mockResolvedValue(2) } as unknown as TraceRuntimeStateRepository
    metricsRepo = { cleanupOld:     vi.fn().mockResolvedValue(10) } as unknown as RuntimeMetricsRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new TraceRecoveryService(traceRepo, stateRepo, metricsRepo, audit, bus)
  })

  it('cleanupStale returns aggregated counts', async () => {
    const result = await svc.cleanupStale(60000)
    expect(result.traces).toBe(3)
    expect(result.states).toBe(2)
    expect(result.metrics).toBe(10)
  })

  it('cleanupStale emits cleanup completed event', async () => {
    await svc.cleanupStale(300000)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:observability:cleanup:completed', expect.any(Object))
  })
})
