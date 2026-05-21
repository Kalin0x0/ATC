import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  initiateFailoverSchema,
  createRecoveryOperationSchema,
  createResilienceSnapshotSchema,
  startChaosTestSchema,
  upsertResilienceSchema,
  cleanupResilienceSchema,
} from '@atc/operations'

export function resilienceRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Failover ─────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/resilience/failover/initiate', async (req, reply) => {
    if (!ctx.failoverOrchestrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateFailoverSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const failover = await ctx.failoverOrchestrationService.initiateFailover(parsed.data)
    return reply.code(200).send(failover)
  })

  fastify.get('/api/v1/resilience/failover/:id', async (req, reply) => {
    if (!ctx.failoverOrchestrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const failover = await ctx.failoverOrchestrationService.getFailover(id)
    if (!failover) return reply.code(404).send({ error: 'Failover not found' })
    return reply.code(200).send(failover)
  })

  fastify.get('/api/v1/resilience/failover/active', async (req, reply) => {
    if (!ctx.failoverOrchestrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { sourceServerId } = req.query as { sourceServerId?: string }
    const failovers = await ctx.failoverOrchestrationService.listActiveFailovers(sourceServerId)
    return reply.code(200).send(failovers)
  })

  fastify.post('/api/v1/resilience/failover/:id/complete', async (req, reply) => {
    if (!ctx.failoverOrchestrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const failover = await ctx.failoverOrchestrationService.completeFailover(id)
    return reply.code(200).send(failover)
  })

  fastify.post('/api/v1/resilience/failover/:id/fail', async (req, reply) => {
    if (!ctx.failoverOrchestrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const failover = await ctx.failoverOrchestrationService.failFailover(id)
    return reply.code(200).send(failover)
  })

  // ── Recovery Operations ──────────────────────────────────────────────────────

  fastify.post('/api/v1/resilience/recovery/initiate', async (req, reply) => {
    if (!ctx.runtimeRecoveryCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createRecoveryOperationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const op = await ctx.runtimeRecoveryCoordinator.initiateRecovery(parsed.data)
    return reply.code(200).send(op)
  })

  fastify.get('/api/v1/resilience/recovery/:id', async (req, reply) => {
    if (!ctx.runtimeRecoveryCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const op = await ctx.runtimeRecoveryCoordinator.getOperation(id)
    if (!op) return reply.code(404).send({ error: 'Recovery operation not found' })
    return reply.code(200).send(op)
  })

  fastify.get('/api/v1/resilience/recovery/active', async (req, reply) => {
    if (!ctx.runtimeRecoveryCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { ownerServerId } = req.query as { ownerServerId?: string }
    const ops = await ctx.runtimeRecoveryCoordinator.listActiveOperations(ownerServerId)
    return reply.code(200).send(ops)
  })

  fastify.post('/api/v1/resilience/recovery/:id/complete', async (req, reply) => {
    if (!ctx.runtimeRecoveryCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const op = await ctx.runtimeRecoveryCoordinator.completeRecovery(id)
    return reply.code(200).send(op)
  })

  fastify.post('/api/v1/resilience/recovery/:id/fail', async (req, reply) => {
    if (!ctx.runtimeRecoveryCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const op = await ctx.runtimeRecoveryCoordinator.failRecovery(id)
    return reply.code(200).send(op)
  })

  // ── Snapshots ────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/resilience/snapshots/create', async (req, reply) => {
    if (!ctx.snapshotRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createResilienceSnapshotSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const snapshot = await ctx.snapshotRecoveryService.createSnapshot(parsed.data)
    return reply.code(200).send(snapshot)
  })

  fastify.get('/api/v1/resilience/snapshots/:id', async (req, reply) => {
    if (!ctx.snapshotRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const snapshot = await ctx.snapshotRecoveryService.getSnapshot(id)
    if (!snapshot) return reply.code(404).send({ error: 'Snapshot not found' })
    return reply.code(200).send(snapshot)
  })

  fastify.get('/api/v1/resilience/snapshots/entity/:entityId', async (req, reply) => {
    if (!ctx.snapshotRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const snapshots = await ctx.snapshotRecoveryService.listByEntity(entityId)
    return reply.code(200).send(snapshots)
  })

  fastify.post('/api/v1/resilience/snapshots/:id/restore', async (req, reply) => {
    if (!ctx.snapshotRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const snapshot = await ctx.snapshotRecoveryService.restoreSnapshot(id)
    return reply.code(200).send(snapshot)
  })

  // ── Chaos Testing ────────────────────────────────────────────────────────────

  fastify.post('/api/v1/resilience/chaos/start', async (req, reply) => {
    if (!ctx.chaosSimulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startChaosTestSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const test = await ctx.chaosSimulationService.startTest(parsed.data)
    return reply.code(200).send(test)
  })

  fastify.get('/api/v1/resilience/chaos/:id', async (req, reply) => {
    if (!ctx.chaosSimulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const test = await ctx.chaosSimulationService.getTest(id)
    if (!test) return reply.code(404).send({ error: 'Chaos test not found' })
    return reply.code(200).send(test)
  })

  fastify.get('/api/v1/resilience/chaos/active', async (_req, reply) => {
    if (!ctx.chaosSimulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const tests = await ctx.chaosSimulationService.listActiveTests()
    return reply.code(200).send(tests)
  })

  fastify.post('/api/v1/resilience/chaos/:id/complete', async (req, reply) => {
    if (!ctx.chaosSimulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const test = await ctx.chaosSimulationService.completeTest(id)
    return reply.code(200).send(test)
  })

  fastify.post('/api/v1/resilience/chaos/:id/abort', async (req, reply) => {
    if (!ctx.chaosSimulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const test = await ctx.chaosSimulationService.abortTest(id)
    return reply.code(200).send(test)
  })

  // ── Health / Resilience Records ──────────────────────────────────────────────

  fastify.post('/api/v1/resilience/health/upsert', async (req, reply) => {
    if (!ctx.resilienceService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertResilienceSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const record = await ctx.resilienceService.upsertHealth(parsed.data)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/resilience/health/:recordId', async (req, reply) => {
    if (!ctx.resilienceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { recordId } = req.params as { recordId: string }
    const record = await ctx.resilienceService.getHealthStatus(recordId)
    if (!record) return reply.code(404).send({ error: 'Health record not found' })
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/resilience/health', async (req, reply) => {
    if (!ctx.resilienceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { ownerServerId } = req.query as { ownerServerId?: string }
    const records = await ctx.resilienceService.listAll(ownerServerId)
    return reply.code(200).send(records)
  })

  // ── Maintenance ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/resilience/cleanup', async (req, reply) => {
    if (!ctx.failoverOrchestrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupResilienceSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const count = await ctx.failoverOrchestrationService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send({ count })
  })
}
