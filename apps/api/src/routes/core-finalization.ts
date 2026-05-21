import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  initiateCoreFinalizationSchema,
  createDeterministicSealingSchema,
  createProductionCompletionSchema,
  upsertFinalizationCoordinationSchema,
  applyFinalSealSchema,
  cleanupCoreFinalizationSchema,
} from '@atc/operations'

export function coreFinalizationRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Core Finalization ────────────────────────────────────────────────────────

  fastify.post('/api/v1/core-finalization', async (req, reply) => {
    if (!ctx.coreFinalizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateCoreFinalizationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { finalizationData, ...rest } = parsed.data
    const record = await ctx.coreFinalizationService.initiateFinalization({
      ...rest,
      ...(finalizationData !== undefined ? { finalizationData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-finalization/:id/activate', async (req, reply) => {
    if (!ctx.coreFinalizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.coreFinalizationService.activateFinalization(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-finalization/:id/begin-completing', async (req, reply) => {
    if (!ctx.coreFinalizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.coreFinalizationService.beginCompleting(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-finalization/:id/complete', async (req, reply) => {
    if (!ctx.coreFinalizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.coreFinalizationService.completeFinalization(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-finalization/:id/fail', async (req, reply) => {
    if (!ctx.coreFinalizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.coreFinalizationService.failFinalization(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/core-finalization/:id', async (req, reply) => {
    if (!ctx.coreFinalizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.coreFinalizationService.getFinalization(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Deterministic Sealing ────────────────────────────────────────────────────

  fastify.post('/api/v1/core-finalization/sealing', async (req, reply) => {
    if (!ctx.deterministicSealService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createDeterministicSealingSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { sealingData, ...rest } = parsed.data
    const record = await ctx.deterministicSealService.createSealing({
      ...rest,
      ...(sealingData !== undefined ? { sealingData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-finalization/sealing/:id/begin', async (req, reply) => {
    if (!ctx.deterministicSealService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicSealService.beginSealing(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-finalization/sealing/:id/apply', async (req, reply) => {
    if (!ctx.deterministicSealService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicSealService.applySealing(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-finalization/sealing/:id/break', async (req, reply) => {
    if (!ctx.deterministicSealService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicSealService.breakSealing(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/core-finalization/sealing/:id', async (req, reply) => {
    if (!ctx.deterministicSealService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.deterministicSealService.getSealing(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Production Completion ────────────────────────────────────────────────────

  fastify.post('/api/v1/core-finalization/completion', async (req, reply) => {
    if (!ctx.productionCompletionService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createProductionCompletionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { completionData, ...rest } = parsed.data
    const record = await ctx.productionCompletionService.createCompletion({
      ...rest,
      ...(completionData !== undefined ? { completionData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-finalization/completion/:id/progress', async (req, reply) => {
    if (!ctx.productionCompletionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.productionCompletionService.progressCompletion(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-finalization/completion/:id/complete', async (req, reply) => {
    if (!ctx.productionCompletionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.productionCompletionService.completeProduction(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-finalization/completion/:id/abort', async (req, reply) => {
    if (!ctx.productionCompletionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.productionCompletionService.abortCompletion(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/core-finalization/completion/:id', async (req, reply) => {
    if (!ctx.productionCompletionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.productionCompletionService.getCompletion(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Runtime Completion Coordinator ──────────────────────────────────────────

  fastify.post('/api/v1/core-finalization/coordination', async (req, reply) => {
    if (!ctx.runtimeCompletionCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertFinalizationCoordinationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { coordinationData, ...rest } = parsed.data
    const record = await ctx.runtimeCompletionCoordinator.upsertCoordination({
      ...rest,
      ...(coordinationData !== undefined ? { coordinationData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-finalization/coordination/:id/progress', async (req, reply) => {
    if (!ctx.runtimeCompletionCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeCompletionCoordinator.progressCoordination(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-finalization/coordination/:id/complete', async (req, reply) => {
    if (!ctx.runtimeCompletionCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeCompletionCoordinator.completeCoordination(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/core-finalization/coordination/:coordinationId', async (req, reply) => {
    if (!ctx.runtimeCompletionCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { coordinationId } = req.params as { coordinationId: string }
    const record = await ctx.runtimeCompletionCoordinator.getCoordination(coordinationId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Distributed Final Seal ───────────────────────────────────────────────────

  fastify.post('/api/v1/core-finalization/seal', async (req, reply) => {
    if (!ctx.distributedFinalSealService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = applyFinalSealSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { sealData, ...rest } = parsed.data
    const record = await ctx.distributedFinalSealService.applyFinalSeal({
      ...rest,
      ...(sealData !== undefined ? { sealData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-finalization/seal/:id/lock', async (req, reply) => {
    if (!ctx.distributedFinalSealService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.distributedFinalSealService.lockSeal(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-finalization/seal/:id/break', async (req, reply) => {
    if (!ctx.distributedFinalSealService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.distributedFinalSealService.breakSeal(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/core-finalization/seal/:id/expire', async (req, reply) => {
    if (!ctx.distributedFinalSealService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.distributedFinalSealService.expireSeal(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/core-finalization/seal/:id', async (req, reply) => {
    if (!ctx.distributedFinalSealService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.distributedFinalSealService.getSeal(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/core-finalization/cleanup', async (req, reply) => {
    if (!ctx.finalizationRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupCoreFinalizationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.finalizationRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
