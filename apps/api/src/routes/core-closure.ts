import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  initiateCoreClosureSchema,
  createImmutabilitySchema,
  initiateFreezeSchema,
  registerClosureNodeSchema,
  createFinalValidationSchema,
  cleanupCoreClosureSchema,
} from '@atc/operations'

export function coreClosureRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Core Closure ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/core-closure', async (req, reply) => {
    if (!ctx.coreClosureService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateCoreClosureSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { closureData, ...rest } = parsed.data
    const record = await ctx.coreClosureService.initiateClosure({
      ...rest,
      ...(closureData !== undefined ? { closureData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-closure/:id/start', async (req, reply) => {
    if (!ctx.coreClosureService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.coreClosureService.startClosure(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-closure/:id/seal', async (req, reply) => {
    if (!ctx.coreClosureService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.coreClosureService.sealClosure(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-closure/:id/fail', async (req, reply) => {
    if (!ctx.coreClosureService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.coreClosureService.failClosure(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/core-closure/:id', async (req, reply) => {
    if (!ctx.coreClosureService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.coreClosureService.getClosure(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Production Immutability ───────────────────────────────────────────────────

  fastify.post('/api/v1/core-closure/immutability', async (req, reply) => {
    if (!ctx.productionImmutabilityService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createImmutabilitySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { immutabilityData, ...rest } = parsed.data
    const record = await ctx.productionImmutabilityService.createImmutability({
      ...rest,
      ...(immutabilityData !== undefined ? { immutabilityData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-closure/immutability/:id/activate', async (req, reply) => {
    if (!ctx.productionImmutabilityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.productionImmutabilityService.activateImmutability(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-closure/immutability/:id/freeze', async (req, reply) => {
    if (!ctx.productionImmutabilityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.productionImmutabilityService.freezeImmutability(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-closure/immutability/:id/violate', async (req, reply) => {
    if (!ctx.productionImmutabilityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.productionImmutabilityService.violateImmutability(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/core-closure/immutability/:id', async (req, reply) => {
    if (!ctx.productionImmutabilityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.productionImmutabilityService.getImmutability(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Production Freeze ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/core-closure/freeze', async (req, reply) => {
    if (!ctx.runtimeFreezeCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateFreezeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { freezeData, ...rest } = parsed.data
    const record = await ctx.runtimeFreezeCoordinator.initiateFreeze({
      ...rest,
      ...(freezeData !== undefined ? { freezeData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-closure/freeze/:freezeId/degrade', async (req, reply) => {
    if (!ctx.runtimeFreezeCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { freezeId } = req.params as { freezeId: string }
    const record = await ctx.runtimeFreezeCoordinator.degradeFreeze(freezeId)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-closure/freeze/:freezeId/recover', async (req, reply) => {
    if (!ctx.runtimeFreezeCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { freezeId } = req.params as { freezeId: string }
    const record = await ctx.runtimeFreezeCoordinator.recoverFreeze(freezeId)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/core-closure/freeze/:freezeId', async (req, reply) => {
    if (!ctx.runtimeFreezeCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { freezeId } = req.params as { freezeId: string }
    const record = await ctx.runtimeFreezeCoordinator.getFreeze(freezeId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Distributed Closure Nodes ─────────────────────────────────────────────────

  fastify.post('/api/v1/core-closure/node', async (req, reply) => {
    if (!ctx.distributedClosureOrchestrator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = registerClosureNodeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { closureNodeData, ...rest } = parsed.data
    const record = await ctx.distributedClosureOrchestrator.registerNode({
      ...rest,
      ...(closureNodeData !== undefined ? { closureNodeData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-closure/node/:closureNodeId/sync', async (req, reply) => {
    if (!ctx.distributedClosureOrchestrator) return reply.code(503).send({ error: 'Service unavailable' })
    const { closureNodeId } = req.params as { closureNodeId: string }
    const record = await ctx.distributedClosureOrchestrator.syncNode(closureNodeId)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-closure/node/:closureNodeId/complete-sync', async (req, reply) => {
    if (!ctx.distributedClosureOrchestrator) return reply.code(503).send({ error: 'Service unavailable' })
    const { closureNodeId } = req.params as { closureNodeId: string }
    const record = await ctx.distributedClosureOrchestrator.completeSyncNode(closureNodeId)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-closure/node/:closureNodeId/degrade', async (req, reply) => {
    if (!ctx.distributedClosureOrchestrator) return reply.code(503).send({ error: 'Service unavailable' })
    const { closureNodeId } = req.params as { closureNodeId: string }
    const record = await ctx.distributedClosureOrchestrator.degradeNode(closureNodeId)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/core-closure/node/:closureNodeId', async (req, reply) => {
    if (!ctx.distributedClosureOrchestrator) return reply.code(503).send({ error: 'Service unavailable' })
    const { closureNodeId } = req.params as { closureNodeId: string }
    const record = await ctx.distributedClosureOrchestrator.getNode(closureNodeId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Final Validation ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/core-closure/validation', async (req, reply) => {
    if (!ctx.deterministicCompletionValidator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createFinalValidationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { validationData, ...rest } = parsed.data
    const record = await ctx.deterministicCompletionValidator.createValidation({
      ...rest,
      ...(validationData !== undefined ? { validationData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-closure/validation/:id/begin', async (req, reply) => {
    if (!ctx.deterministicCompletionValidator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicCompletionValidator.beginValidating(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-closure/validation/:id/complete', async (req, reply) => {
    if (!ctx.deterministicCompletionValidator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicCompletionValidator.completeValidation(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-closure/validation/:id/fail', async (req, reply) => {
    if (!ctx.deterministicCompletionValidator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicCompletionValidator.failValidation(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/core-closure/validation/:id', async (req, reply) => {
    if (!ctx.deterministicCompletionValidator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicCompletionValidator.getValidation(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/core-closure/cleanup', async (req, reply) => {
    if (!ctx.finalRecoveryCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupCoreClosureSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.finalRecoveryCoordinator.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
