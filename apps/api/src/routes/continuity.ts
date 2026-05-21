import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  createContinuitySchema,
  initiateTemporalRecoverySchema,
  createCheckpointSchema,
  upsertPersistenceNodeSchema,
  createTemporalIntegritySchema,
  cleanupContinuitySchema,
} from '@atc/operations'

export function continuityRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Runtime Continuity ───────────────────────────────────────────────────────

  fastify.post('/api/v1/continuity', async (req, reply) => {
    if (!ctx.continuityRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createContinuitySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { continuityData, ...rest } = parsed.data
    const continuity = await ctx.continuityRuntimeService.createContinuity({
      ...rest,
      ...(continuityData !== undefined ? { continuityData } : {}),
    })
    return reply.code(200).send(continuity)
  })

  fastify.post('/api/v1/continuity/:id/suspend', async (req, reply) => {
    if (!ctx.continuityRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const continuity = await ctx.continuityRuntimeService.suspendContinuity(id)
    return reply.code(200).send(continuity)
  })

  fastify.post('/api/v1/continuity/:id/terminate', async (req, reply) => {
    if (!ctx.continuityRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const continuity = await ctx.continuityRuntimeService.terminateContinuity(id)
    return reply.code(200).send(continuity)
  })

  fastify.post('/api/v1/continuity/:id/fail', async (req, reply) => {
    if (!ctx.continuityRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const continuity = await ctx.continuityRuntimeService.failContinuity(id)
    return reply.code(200).send(continuity)
  })

  fastify.get('/api/v1/continuity/:id', async (req, reply) => {
    if (!ctx.continuityRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const continuity = await ctx.continuityRuntimeService.getContinuity(id)
    if (!continuity) return reply.code(404).send({ error: 'Continuity record not found' })
    return reply.code(200).send(continuity)
  })

  // ── Temporal Recovery ────────────────────────────────────────────────────────

  fastify.post('/api/v1/continuity/recovery', async (req, reply) => {
    if (!ctx.temporalRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateTemporalRecoverySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { recoveryData, targetTimestamp, ...rest } = parsed.data
    const recovery = await ctx.temporalRecoveryService.initiateRecovery({
      ...rest,
      ...(recoveryData !== undefined ? { recoveryData } : {}),
      ...(targetTimestamp !== undefined ? { targetTimestamp: new Date(targetTimestamp) } : {}),
    })
    return reply.code(200).send(recovery)
  })

  fastify.post('/api/v1/continuity/recovery/:id/begin', async (req, reply) => {
    if (!ctx.temporalRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const recovery = await ctx.temporalRecoveryService.beginRecovering(id)
    return reply.code(200).send(recovery)
  })

  fastify.post('/api/v1/continuity/recovery/:id/complete', async (req, reply) => {
    if (!ctx.temporalRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const recovery = await ctx.temporalRecoveryService.completeRecovery(id)
    return reply.code(200).send(recovery)
  })

  fastify.post('/api/v1/continuity/recovery/:id/fail', async (req, reply) => {
    if (!ctx.temporalRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const recovery = await ctx.temporalRecoveryService.failRecovery(id)
    return reply.code(200).send(recovery)
  })

  fastify.get('/api/v1/continuity/recovery/:id', async (req, reply) => {
    if (!ctx.temporalRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const recovery = await ctx.temporalRecoveryService.getRecovery(id)
    if (!recovery) return reply.code(404).send({ error: 'Temporal recovery record not found' })
    return reply.code(200).send(recovery)
  })

  // ── Checkpoints ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/continuity/checkpoint', async (req, reply) => {
    if (!ctx.runtimeCheckpointCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createCheckpointSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { checkpointData, ...rest } = parsed.data
    const checkpoint = await ctx.runtimeCheckpointCoordinator.createCheckpoint({
      ...rest,
      ...(checkpointData !== undefined ? { checkpointData } : {}),
    })
    return reply.code(200).send(checkpoint)
  })

  fastify.post('/api/v1/continuity/checkpoint/:id/commit', async (req, reply) => {
    if (!ctx.runtimeCheckpointCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const checkpoint = await ctx.runtimeCheckpointCoordinator.commitCheckpoint(id)
    return reply.code(200).send(checkpoint)
  })

  fastify.post('/api/v1/continuity/checkpoint/:id/rollback', async (req, reply) => {
    if (!ctx.runtimeCheckpointCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const checkpoint = await ctx.runtimeCheckpointCoordinator.rollbackCheckpoint(id)
    return reply.code(200).send(checkpoint)
  })

  fastify.get('/api/v1/continuity/checkpoint/:id', async (req, reply) => {
    if (!ctx.runtimeCheckpointCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const checkpoint = await ctx.runtimeCheckpointCoordinator.getCheckpoint(id)
    if (!checkpoint) return reply.code(404).send({ error: 'Checkpoint not found' })
    return reply.code(200).send(checkpoint)
  })

  // ── Persistence Nodes ────────────────────────────────────────────────────────

  fastify.post('/api/v1/continuity/persistence', async (req, reply) => {
    if (!ctx.infinitePersistenceService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertPersistenceNodeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { persistenceData, ...rest } = parsed.data
    const node = await ctx.infinitePersistenceService.upsertPersistenceNode({
      ...rest,
      ...(persistenceData !== undefined ? { persistenceData } : {}),
    })
    return reply.code(200).send(node)
  })

  fastify.post('/api/v1/continuity/persistence/:nodeId/fail', async (req, reply) => {
    if (!ctx.infinitePersistenceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { nodeId } = req.params as { nodeId: string }
    await ctx.infinitePersistenceService.failNode(nodeId)
    return reply.code(204).send()
  })

  fastify.get('/api/v1/continuity/persistence/:nodeId', async (req, reply) => {
    if (!ctx.infinitePersistenceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { nodeId } = req.params as { nodeId: string }
    const node = await ctx.infinitePersistenceService.getPersistenceNode(nodeId)
    if (!node) return reply.code(404).send({ error: 'Persistence node not found' })
    return reply.code(200).send(node)
  })

  // ── Temporal Integrity ───────────────────────────────────────────────────────

  fastify.post('/api/v1/continuity/temporal-integrity', async (req, reply) => {
    if (!ctx.temporalIntegrityRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createTemporalIntegritySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { integrityData, ...rest } = parsed.data
    const integrity = await ctx.temporalIntegrityRecoveryService.createTemporalIntegrity({
      ...rest,
      ...(integrityData !== undefined ? { integrityData } : {}),
    })
    return reply.code(200).send(integrity)
  })

  fastify.post('/api/v1/continuity/temporal-integrity/:id/repair', async (req, reply) => {
    if (!ctx.temporalIntegrityRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const integrity = await ctx.temporalIntegrityRecoveryService.repairTemporalIntegrity(id)
    return reply.code(200).send(integrity)
  })

  fastify.post('/api/v1/continuity/temporal-integrity/:id/validate', async (req, reply) => {
    if (!ctx.temporalIntegrityRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const integrity = await ctx.temporalIntegrityRecoveryService.validateTemporalIntegrity(id)
    return reply.code(200).send(integrity)
  })

  fastify.get('/api/v1/continuity/temporal-integrity/:id', async (req, reply) => {
    if (!ctx.temporalIntegrityRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const integrity = await ctx.temporalIntegrityRecoveryService.getTemporalIntegrity(id)
    if (!integrity) return reply.code(404).send({ error: 'Temporal integrity record not found' })
    return reply.code(200).send(integrity)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/continuity/cleanup', async (req, reply) => {
    if (!ctx.temporalIntegrityRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupContinuitySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.temporalIntegrityRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
