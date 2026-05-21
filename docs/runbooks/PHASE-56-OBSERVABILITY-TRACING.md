# Phase 56 — Distributed Observability, Telemetry & Runtime Tracing

## Overview

Phase 56 provides server-authoritative distributed observability for the ATC runtime. It covers trace lifecycle management, metric ingestion, failure correlation, runtime diagnostics, and cleanup. All operations are server-side only; client-sourced metrics are rate-limited.

**Package:** `@atc/runtime-observability`
**API prefix:** `/api/v1/observability`
**FiveM bridge:** `game/atc-core/server/observability.lua`

---

## Services

| Service | Responsibility |
|---|---|
| `RuntimeTelemetryService` | Start, end, fail, and list distributed traces |
| `DistributedTracingService` | Upsert and clear per-entity trace runtime state |
| `RuntimeMetricsService` | Record and retrieve runtime metrics |
| `FailureCorrelationService` | Create and resolve failure correlation events |
| `RuntimeDiagnosticsService` | Run, pass, fail, and list diagnostics |
| `TraceRecoveryService` | Cleanup stale traces, states, and metrics |

---

## Database Tables

| Table | Purpose |
|---|---|
| `atc_runtime_traces` | Distributed trace records with nonce idempotency |
| `atc_runtime_metrics` | Point-in-time metric readings per entity |
| `atc_failure_correlation` | Failure events grouped by correlation type |
| `atc_runtime_diagnostics` | Diagnostic run records with pass/fail outcome |
| `atc_trace_runtime` | Per-entity active trace state (upsert by entity_id) |
| `atc_observability_audit` | Append-only audit log for all observability events |

---

## API Endpoints

### Traces
- `POST /api/v1/observability/traces/start` — Start a trace (server-only)
- `POST /api/v1/observability/traces/:id/complete` — Mark trace completed
- `POST /api/v1/observability/traces/:id/fail` — Mark trace failed
- `GET  /api/v1/observability/traces/:id` — Fetch trace by ID
- `GET  /api/v1/observability/traces/active` — List active traces

### Metrics
- `POST /api/v1/observability/metrics/record` — Record a metric (rate-limited for client sources)
- `GET  /api/v1/observability/metrics/:entityId` — List metrics for entity

### Correlation
- `POST /api/v1/observability/correlation/create` — Create failure correlation
- `POST /api/v1/observability/correlation/:id/resolve` — Resolve correlation
- `GET  /api/v1/observability/correlation/:id` — Fetch correlation
- `GET  /api/v1/observability/correlation/open` — List open correlations

### Diagnostics
- `POST /api/v1/observability/diagnostics/run` — Run a diagnostic
- `POST /api/v1/observability/diagnostics/:id/complete` — Pass diagnostic
- `POST /api/v1/observability/diagnostics/:id/fail` — Fail diagnostic
- `GET  /api/v1/observability/diagnostics/:entityId` — List diagnostics for entity

### Trace State
- `POST /api/v1/observability/trace-state/upsert` — Upsert entity trace state
- `GET  /api/v1/observability/trace-state/:entityId` — Get entity trace state

### Cleanup
- `POST /api/v1/observability/cleanup` — Purge stale traces, states, metrics

---

## FiveM Events

| Event | Direction | Description |
|---|---|---|
| `atc:observability:trace:start` | Server-only | Start a distributed trace |
| `atc:observability:metric:record` | Client → Server (rate-limited, 60/min) | Record a runtime metric |
| `atc:observability:correlation:create` | Server-only | Record a failure correlation |
| `atc:observability:cleanup` | Scheduler | Purge stale observability data |

---

## Idempotency

Traces are idempotent by `(trace_nonce, owner_server_id)` UNIQUE constraint. Duplicate INSERTs return `DuplicateTraceError` (HTTP 409). Callers should persist the nonce and retry detection logic on their side.

---

## Rate Limiting

The `atc:observability:metric:record` net event is rate-limited server-side: 60 metrics per client per 60-second window. Excess calls are silently dropped (no error returned to client).

---

## Cleanup

Call `POST /api/v1/observability/cleanup` with `{ "thresholdMs": 300000 }` (default: 5 minutes). The scheduler bridge event `atc:observability:cleanup` fires this from FiveM. Returns `{ traces, states, metrics }` purge counts.

---

## Context Keys (AppContext)

```typescript
runtimeTelemetryService?:     RuntimeTelemetryService
distributedTracingService?:   DistributedTracingService
runtimeMetricsService?:       RuntimeMetricsService
failureCorrelationService?:   FailureCorrelationService
runtimeDiagnosticsService?:   RuntimeDiagnosticsService
traceRecoveryService?:        TraceRecoveryService
traceRuntimeRepo?:            TraceRuntimeRepository
runtimeMetricsRepo?:          RuntimeMetricsRepository
failureCorrelationRepo?:      FailureCorrelationRepository
runtimeDiagnosticsRepo?:      RuntimeDiagnosticsRepository
traceRuntimeStateRepo?:       TraceRuntimeStateRepository
observabilityAuditRepo?:      ObservabilityAuditRepository
```

---

## Error Reference

| Error | HTTP | Trigger |
|---|---|---|
| `TraceNotFoundError` | 404 | Trace ID not in DB |
| `DuplicateTraceError` | 409 | Duplicate `(trace_nonce, owner_server_id)` |
| `CorrelationNotFoundError` | 404 | Correlation ID not in DB |
| `DiagnosticNotFoundError` | 404 | Diagnostic ID not in DB |
