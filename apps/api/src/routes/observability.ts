import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  startTraceSchema,
  recordMetricSchema,
  createCorrelationSchema,
  runDiagnosticSchema,
  upsertTraceStateSchema,
  cleanupObservabilitySchema,
} from '@atc/operations'

export function observabilityRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Traces ───────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/observability/traces/start', async (req, reply) => {
    if (!ctx.runtimeTelemetryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startTraceSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { targetNode, traceData, ...rest } = parsed.data
    const trace = await ctx.runtimeTelemetryService.startTrace({
      ...rest,
      ...(targetNode !== undefined ? { targetNode } : {}),
      ...(traceData !== undefined ? { traceData } : {}),
    })
    return reply.code(200).send(trace)
  })

  fastify.post('/api/v1/observability/traces/:id/end', async (req, reply) => {
    if (!ctx.runtimeTelemetryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const trace = await ctx.runtimeTelemetryService.endTrace(id)
    return reply.code(200).send(trace)
  })

  fastify.get('/api/v1/observability/traces/:id', async (req, reply) => {
    if (!ctx.runtimeTelemetryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const trace = await ctx.runtimeTelemetryService.getTrace(id)
    if (!trace) return reply.code(404).send({ error: 'Trace not found' })
    return reply.code(200).send(trace)
  })

  fastify.get('/api/v1/observability/traces/active', async (req, reply) => {
    if (!ctx.runtimeTelemetryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { ownerServerId } = req.query as { ownerServerId?: string }
    const traces = await ctx.runtimeTelemetryService.listActiveTraces(ownerServerId)
    return reply.code(200).send(traces)
  })

  // ── Metrics ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/observability/metrics/record', async (req, reply) => {
    if (!ctx.runtimeMetricsService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = recordMetricSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { entityId, unit, metricData, ...rest } = parsed.data
    const metric = await ctx.runtimeMetricsService.recordMetric({
      ...rest,
      ...(entityId !== undefined ? { entityId } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(metricData !== undefined ? { metricData } : {}),
    })
    return reply.code(200).send(metric)
  })

  fastify.get('/api/v1/observability/metrics/:entityId', async (req, reply) => {
    if (!ctx.runtimeMetricsService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const metrics = await ctx.runtimeMetricsService.getMetrics(entityId)
    return reply.code(200).send(metrics)
  })

  // ── Failure Correlation ──────────────────────────────────────────────────────

  fastify.post('/api/v1/observability/correlation/create', async (req, reply) => {
    if (!ctx.failureCorrelationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createCorrelationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { correlationData, ...rest } = parsed.data
    const correlation = await ctx.failureCorrelationService.createCorrelation({
      ...rest,
      ...(correlationData !== undefined ? { correlationData } : {}),
    })
    return reply.code(200).send(correlation)
  })

  fastify.post('/api/v1/observability/correlation/:id/resolve', async (req, reply) => {
    if (!ctx.failureCorrelationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const correlation = await ctx.failureCorrelationService.resolveCorrelation(id)
    return reply.code(200).send(correlation)
  })

  fastify.get('/api/v1/observability/correlation/:id', async (req, reply) => {
    if (!ctx.failureCorrelationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const correlation = await ctx.failureCorrelationService.getCorrelation(id)
    if (!correlation) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(correlation)
  })

  // ── Diagnostics ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/observability/diagnostics/run', async (req, reply) => {
    if (!ctx.runtimeDiagnosticsService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = runDiagnosticSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { entityId, diagnosticData, ...rest } = parsed.data
    const diagnostic = await ctx.runtimeDiagnosticsService.runDiagnostic({
      ...rest,
      ...(entityId !== undefined ? { entityId } : {}),
      ...(diagnosticData !== undefined ? { diagnosticData } : {}),
    })
    return reply.code(200).send(diagnostic)
  })

  fastify.get('/api/v1/observability/diagnostics/:entityId', async (req, reply) => {
    if (!ctx.runtimeDiagnosticsService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const diagnostics = await ctx.runtimeDiagnosticsService.getDiagnostics(entityId)
    return reply.code(200).send(diagnostics)
  })

  // ── Trace State ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/observability/trace-state/upsert', async (req, reply) => {
    if (!ctx.distributedTracingService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertTraceStateSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { expiresAt, traceData, ...rest } = parsed.data
    const state = await ctx.distributedTracingService.upsertTraceState({
      ...rest,
      ...(expiresAt !== undefined ? { expiresAt: new Date(expiresAt) } : {}),
      ...(traceData !== undefined ? { traceData } : {}),
    })
    return reply.code(200).send(state)
  })

  fastify.get('/api/v1/observability/trace-state/:entityId', async (req, reply) => {
    if (!ctx.distributedTracingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const state = await ctx.distributedTracingService.getTraceState(entityId)
    if (!state) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(state)
  })

  fastify.delete('/api/v1/observability/trace-state/:entityId', async (req, reply) => {
    if (!ctx.distributedTracingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    await ctx.distributedTracingService.clearTraceState(entityId)
    return reply.code(204).send()
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/observability/cleanup', async (req, reply) => {
    if (!ctx.traceRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupObservabilitySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.traceRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
