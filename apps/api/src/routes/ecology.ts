import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  createEcologySchema,
  startEvolutionSchema,
  startRegenerationSchema,
  upsertClimateSchema,
  upsertWildlifeSchema,
  cleanupEcologySchema,
} from '@atc/operations'

export function ecologyRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Ecology Runtime ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/ecology/create', async (req, reply) => {
    if (!ctx.ecologyRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createEcologySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { regionId, ecologyData, ...rest } = parsed.data
    const ecology = await ctx.ecologyRuntimeService.createEcology({
      ...rest,
      ...(regionId !== undefined ? { regionId } : {}),
      ...(ecologyData !== undefined ? { ecologyData } : {}),
    })
    return reply.code(200).send(ecology)
  })

  fastify.post('/api/v1/ecology/:id/degrade', async (req, reply) => {
    if (!ctx.ecologyRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const ecology = await ctx.ecologyRuntimeService.degradeEcology(id)
    return reply.code(200).send(ecology)
  })

  fastify.get('/api/v1/ecology/:id', async (req, reply) => {
    if (!ctx.ecologyRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const ecology = await ctx.ecologyRuntimeService.getEcology(id)
    if (!ecology) return reply.code(404).send({ error: 'Ecology not found' })
    return reply.code(200).send(ecology)
  })

  fastify.get('/api/v1/ecology/active', async (req, reply) => {
    if (!ctx.ecologyRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { ownerServerId } = req.query as { ownerServerId?: string }
    const ecologies = await ctx.ecologyRuntimeService.listActiveEcologies(ownerServerId)
    return reply.code(200).send(ecologies)
  })

  // ── Environmental Evolution ──────────────────────────────────────────────────

  fastify.post('/api/v1/ecology/evolution/start', async (req, reply) => {
    if (!ctx.environmentalEvolutionService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startEvolutionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { regionId, evolutionData, ...rest } = parsed.data
    const evolution = await ctx.environmentalEvolutionService.startEvolution({
      ...rest,
      ...(regionId !== undefined ? { regionId } : {}),
      ...(evolutionData !== undefined ? { evolutionData } : {}),
    })
    return reply.code(200).send(evolution)
  })

  fastify.post('/api/v1/ecology/evolution/:id/complete', async (req, reply) => {
    if (!ctx.environmentalEvolutionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const evolution = await ctx.environmentalEvolutionService.completeEvolution(id)
    return reply.code(200).send(evolution)
  })

  fastify.post('/api/v1/ecology/evolution/:id/fail', async (req, reply) => {
    if (!ctx.environmentalEvolutionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const evolution = await ctx.environmentalEvolutionService.failEvolution(id)
    return reply.code(200).send(evolution)
  })

  fastify.get('/api/v1/ecology/evolution/:id', async (req, reply) => {
    if (!ctx.environmentalEvolutionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const evolution = await ctx.environmentalEvolutionService.getEvolution(id)
    if (!evolution) return reply.code(404).send({ error: 'Evolution not found' })
    return reply.code(200).send(evolution)
  })

  // ── Resource Regeneration ────────────────────────────────────────────────────

  fastify.post('/api/v1/ecology/regeneration/start', async (req, reply) => {
    if (!ctx.resourceRegenerationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startRegenerationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { regionId, regenerationData, ...rest } = parsed.data
    const regeneration = await ctx.resourceRegenerationService.startRegeneration({
      ...rest,
      ...(regionId !== undefined ? { regionId } : {}),
      ...(regenerationData !== undefined ? { regenerationData } : {}),
    })
    return reply.code(200).send(regeneration)
  })

  fastify.post('/api/v1/ecology/regeneration/:id/complete', async (req, reply) => {
    if (!ctx.resourceRegenerationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const regeneration = await ctx.resourceRegenerationService.completeRegeneration(id)
    return reply.code(200).send(regeneration)
  })

  fastify.post('/api/v1/ecology/regeneration/:id/fail', async (req, reply) => {
    if (!ctx.resourceRegenerationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const regeneration = await ctx.resourceRegenerationService.failRegeneration(id)
    return reply.code(200).send(regeneration)
  })

  fastify.get('/api/v1/ecology/regeneration/:id', async (req, reply) => {
    if (!ctx.resourceRegenerationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const regeneration = await ctx.resourceRegenerationService.getRegeneration(id)
    if (!regeneration) return reply.code(404).send({ error: 'Regeneration not found' })
    return reply.code(200).send(regeneration)
  })

  // ── Climate Persistence ──────────────────────────────────────────────────────

  fastify.post('/api/v1/ecology/climate', async (req, reply) => {
    if (!ctx.climatePersistenceService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertClimateSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { climateData, ...rest } = parsed.data
    const climate = await ctx.climatePersistenceService.upsertClimate({
      ...rest,
      ...(climateData !== undefined ? { climateData } : {}),
    })
    return reply.code(200).send(climate)
  })

  fastify.get('/api/v1/ecology/climate/:regionId', async (req, reply) => {
    if (!ctx.climatePersistenceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { regionId } = req.params as { regionId: string }
    const climate = await ctx.climatePersistenceService.getClimate(regionId)
    if (!climate) return reply.code(404).send({ error: 'Climate data not found' })
    return reply.code(200).send(climate)
  })

  // ── Wildlife Simulation ──────────────────────────────────────────────────────

  fastify.post('/api/v1/ecology/wildlife', async (req, reply) => {
    if (!ctx.wildlifeSimulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertWildlifeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { wildlifeData, ...rest } = parsed.data
    const wildlife = await ctx.wildlifeSimulationService.upsertWildlife({
      ...rest,
      ...(wildlifeData !== undefined ? { wildlifeData } : {}),
    })
    return reply.code(200).send(wildlife)
  })

  fastify.get('/api/v1/ecology/wildlife/:zoneId', async (req, reply) => {
    if (!ctx.wildlifeSimulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { zoneId } = req.params as { zoneId: string }
    const wildlife = await ctx.wildlifeSimulationService.getWildlife(zoneId)
    if (!wildlife) return reply.code(404).send({ error: 'Wildlife data not found' })
    return reply.code(200).send(wildlife)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/ecology/cleanup', async (req, reply) => {
    if (!ctx.ecologyRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupEcologySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.ecologyRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
