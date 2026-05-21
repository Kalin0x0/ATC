import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  startRuntimeEvolutionSchema,
  startOptimizationSchema,
  upsertTuningSchema,
  triggerAutonomousEvolutionSchema,
  upsertDistributedOptSchema,
  cleanupEvolutionSchema,
} from '@atc/operations'

export function evolutionRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Runtime Evolution ────────────────────────────────────────────────────────

  fastify.post('/api/v1/evolution/start', async (req, reply) => {
    if (!ctx.evolutionRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startRuntimeEvolutionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { evolutionData, ...rest } = parsed.data
    const evolution = await ctx.evolutionRuntimeService.startEvolution({
      ...rest,
      ...(evolutionData !== undefined ? { evolutionData } : {}),
    })
    return reply.code(200).send(evolution)
  })

  fastify.post('/api/v1/evolution/:id/activate', async (req, reply) => {
    if (!ctx.evolutionRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const evolution = await ctx.evolutionRuntimeService.activateEvolution(id)
    return reply.code(200).send(evolution)
  })

  fastify.post('/api/v1/evolution/:id/complete', async (req, reply) => {
    if (!ctx.evolutionRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const evolution = await ctx.evolutionRuntimeService.completeEvolution(id)
    return reply.code(200).send(evolution)
  })

  fastify.post('/api/v1/evolution/:id/fail', async (req, reply) => {
    if (!ctx.evolutionRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const evolution = await ctx.evolutionRuntimeService.failEvolution(id)
    return reply.code(200).send(evolution)
  })

  fastify.post('/api/v1/evolution/:id/rollback', async (req, reply) => {
    if (!ctx.evolutionRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const evolution = await ctx.evolutionRuntimeService.rollbackEvolution(id)
    return reply.code(200).send(evolution)
  })

  fastify.get('/api/v1/evolution/:id', async (req, reply) => {
    if (!ctx.evolutionRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const evolution = await ctx.evolutionRuntimeService.getEvolution(id)
    if (!evolution) return reply.code(404).send({ error: 'Evolution not found' })
    return reply.code(200).send(evolution)
  })

  // ── Adaptive Optimization ────────────────────────────────────────────────────

  fastify.post('/api/v1/evolution/optimize', async (req, reply) => {
    if (!ctx.adaptiveOptimizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startOptimizationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { optimizationData, ...rest } = parsed.data
    const optimization = await ctx.adaptiveOptimizationService.startOptimization({
      ...rest,
      ...(optimizationData !== undefined ? { optimizationData } : {}),
    })
    return reply.code(200).send(optimization)
  })

  fastify.post('/api/v1/evolution/optimize/:id/complete', async (req, reply) => {
    if (!ctx.adaptiveOptimizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const optimization = await ctx.adaptiveOptimizationService.completeOptimization(id)
    return reply.code(200).send(optimization)
  })

  fastify.post('/api/v1/evolution/optimize/:id/fail', async (req, reply) => {
    if (!ctx.adaptiveOptimizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const optimization = await ctx.adaptiveOptimizationService.failOptimization(id)
    return reply.code(200).send(optimization)
  })

  fastify.get('/api/v1/evolution/optimize/:id', async (req, reply) => {
    if (!ctx.adaptiveOptimizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const optimization = await ctx.adaptiveOptimizationService.getOptimization(id)
    if (!optimization) return reply.code(404).send({ error: 'Optimization not found' })
    return reply.code(200).send(optimization)
  })

  // ── Runtime Tuning ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/evolution/tune', async (req, reply) => {
    if (!ctx.runtimeTuningService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertTuningSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { tuningData, ...rest } = parsed.data
    const tuning = await ctx.runtimeTuningService.upsertTuning({
      ...rest,
      ...(tuningData !== undefined ? { tuningData } : {}),
    })
    return reply.code(200).send(tuning)
  })

  fastify.get('/api/v1/evolution/tune/:entityId', async (req, reply) => {
    if (!ctx.runtimeTuningService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const tuning = await ctx.runtimeTuningService.getTuning(entityId)
    if (!tuning) return reply.code(404).send({ error: 'Tuning not found' })
    return reply.code(200).send(tuning)
  })

  // ── Autonomous Evolution ─────────────────────────────────────────────────────

  fastify.post('/api/v1/evolution/autonomous/trigger', async (req, reply) => {
    if (!ctx.autonomousEvolutionService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = triggerAutonomousEvolutionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { triggerData, ...rest } = parsed.data
    const autonomous = await ctx.autonomousEvolutionService.triggerEvolution({
      ...rest,
      ...(triggerData !== undefined ? { triggerData } : {}),
    })
    return reply.code(200).send(autonomous)
  })

  fastify.post('/api/v1/evolution/autonomous/:id/apply', async (req, reply) => {
    if (!ctx.autonomousEvolutionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const autonomous = await ctx.autonomousEvolutionService.applyEvolution(id)
    return reply.code(200).send(autonomous)
  })

  fastify.post('/api/v1/evolution/autonomous/:id/revert', async (req, reply) => {
    if (!ctx.autonomousEvolutionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const autonomous = await ctx.autonomousEvolutionService.revertEvolution(id)
    return reply.code(200).send(autonomous)
  })

  fastify.get('/api/v1/evolution/autonomous/:id', async (req, reply) => {
    if (!ctx.autonomousEvolutionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const autonomous = await ctx.autonomousEvolutionService.getEvolution(id)
    if (!autonomous) return reply.code(404).send({ error: 'Autonomous evolution not found' })
    return reply.code(200).send(autonomous)
  })

  // ── Distributed Optimization ─────────────────────────────────────────────────

  fastify.post('/api/v1/evolution/distributed-opt', async (req, reply) => {
    if (!ctx.distributedOptimizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertDistributedOptSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { optData, ...rest } = parsed.data
    const opt = await ctx.distributedOptimizationService.upsertOptimization({
      ...rest,
      ...(optData !== undefined ? { optData } : {}),
    })
    return reply.code(200).send(opt)
  })

  fastify.post('/api/v1/evolution/distributed-opt/:nodeId/fail', async (req, reply) => {
    if (!ctx.distributedOptimizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { nodeId } = req.params as { nodeId: string }
    await ctx.distributedOptimizationService.failNode(nodeId)
    return reply.code(204).send()
  })

  fastify.get('/api/v1/evolution/distributed-opt/:nodeId', async (req, reply) => {
    if (!ctx.distributedOptimizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { nodeId } = req.params as { nodeId: string }
    const opt = await ctx.distributedOptimizationService.getOptimization(nodeId)
    if (!opt) return reply.code(404).send({ error: 'Distributed optimization not found' })
    return reply.code(200).send(opt)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/evolution/cleanup', async (req, reply) => {
    if (!ctx.evolutionRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupEvolutionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.evolutionRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
