import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  establishSovereigntySchema,
  registerClusterSchema,
  initiateAutonomousFinalizationSchema,
  initiateSuccessionSchema,
  upsertSovereigntyCoordinationSchema,
  cleanupSovereigntySchema,
} from '@atc/operations'

export function runtimeSovereigntyRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Runtime Sovereignty ──────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-sovereignty', async (req, reply) => {
    if (!ctx.runtimeSovereigntyService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = establishSovereigntySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { sovereigntyData, ...rest } = parsed.data
    const record = await ctx.runtimeSovereigntyService.establishSovereignty({
      ...rest,
      ...(sovereigntyData !== undefined ? { sovereigntyData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/:id/confirm', async (req, reply) => {
    if (!ctx.runtimeSovereigntyService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSovereigntyService.confirmSovereignty(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/:id/challenge', async (req, reply) => {
    if (!ctx.runtimeSovereigntyService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSovereigntyService.challengeSovereignty(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/:id/revoke', async (req, reply) => {
    if (!ctx.runtimeSovereigntyService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSovereigntyService.revokeSovereignty(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/:id/expire', async (req, reply) => {
    if (!ctx.runtimeSovereigntyService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSovereigntyService.expireSovereignty(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-sovereignty/:id', async (req, reply) => {
    if (!ctx.runtimeSovereigntyService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSovereigntyService.getSovereignty(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Infinite Cluster Continuity ──────────────────────────────────────────────

  fastify.post('/api/v1/runtime-sovereignty/cluster', async (req, reply) => {
    if (!ctx.infiniteClusterContinuityService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = registerClusterSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { clusterData, ...rest } = parsed.data
    const record = await ctx.infiniteClusterContinuityService.registerCluster({
      ...rest,
      ...(clusterData !== undefined ? { clusterData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/cluster/:id/degrade', async (req, reply) => {
    if (!ctx.infiniteClusterContinuityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.infiniteClusterContinuityService.degradeCluster(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/cluster/:id/recover', async (req, reply) => {
    if (!ctx.infiniteClusterContinuityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.infiniteClusterContinuityService.recoverCluster(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/cluster/:id/fail', async (req, reply) => {
    if (!ctx.infiniteClusterContinuityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.infiniteClusterContinuityService.failCluster(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-sovereignty/cluster/:clusterId', async (req, reply) => {
    if (!ctx.infiniteClusterContinuityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { clusterId } = req.params as { clusterId: string }
    const record = await ctx.infiniteClusterContinuityService.getCluster(clusterId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Autonomous Finalization ──────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-sovereignty/finalization', async (req, reply) => {
    if (!ctx.autonomousFinalizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateAutonomousFinalizationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { finalizationData, ...rest } = parsed.data
    const record = await ctx.autonomousFinalizationService.initiateFinalization({
      ...rest,
      ...(finalizationData !== undefined ? { finalizationData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/finalization/:id/process', async (req, reply) => {
    if (!ctx.autonomousFinalizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.autonomousFinalizationService.processFinalization(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/finalization/:id/complete', async (req, reply) => {
    if (!ctx.autonomousFinalizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.autonomousFinalizationService.completeFinalization(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/finalization/:id/abort', async (req, reply) => {
    if (!ctx.autonomousFinalizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.autonomousFinalizationService.abortFinalization(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/finalization/:id/fail', async (req, reply) => {
    if (!ctx.autonomousFinalizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.autonomousFinalizationService.failFinalization(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-sovereignty/finalization/:id', async (req, reply) => {
    if (!ctx.autonomousFinalizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.autonomousFinalizationService.getFinalization(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Runtime Succession ───────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-sovereignty/succession', async (req, reply) => {
    if (!ctx.runtimeSuccessionService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateSuccessionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { successionData, targetServerId, ...rest } = parsed.data
    const record = await ctx.runtimeSuccessionService.initiateSuccession({
      ...rest,
      ...(targetServerId !== undefined ? { targetServerId } : {}),
      ...(successionData !== undefined ? { successionData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/succession/:id/transfer', async (req, reply) => {
    if (!ctx.runtimeSuccessionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSuccessionService.beginTransfer(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/succession/:id/complete', async (req, reply) => {
    if (!ctx.runtimeSuccessionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSuccessionService.completeSuccession(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/succession/:id/fail', async (req, reply) => {
    if (!ctx.runtimeSuccessionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSuccessionService.failSuccession(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/succession/:id/revert', async (req, reply) => {
    if (!ctx.runtimeSuccessionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSuccessionService.revertSuccession(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-sovereignty/succession/:id', async (req, reply) => {
    if (!ctx.runtimeSuccessionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSuccessionService.getSuccession(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Distributed Sovereignty Coordination ────────────────────────────────────

  fastify.post('/api/v1/runtime-sovereignty/coordination', async (req, reply) => {
    if (!ctx.distributedSovereigntyCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertSovereigntyCoordinationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { coordinationData, ...rest } = parsed.data
    const record = await ctx.distributedSovereigntyCoordinator.upsertCoordination({
      ...rest,
      ...(coordinationData !== undefined ? { coordinationData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/coordination/:id/suspend', async (req, reply) => {
    if (!ctx.distributedSovereigntyCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.distributedSovereigntyCoordinator.suspendCoordination(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sovereignty/coordination/:id/expire', async (req, reply) => {
    if (!ctx.distributedSovereigntyCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.distributedSovereigntyCoordinator.expireCoordination(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-sovereignty/coordination/:coordinationId', async (req, reply) => {
    if (!ctx.distributedSovereigntyCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { coordinationId } = req.params as { coordinationId: string }
    const record = await ctx.distributedSovereigntyCoordinator.getCoordination(coordinationId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-sovereignty/cleanup', async (req, reply) => {
    if (!ctx.sovereigntyRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupSovereigntySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.sovereigntyRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
