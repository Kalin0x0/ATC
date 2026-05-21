import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  upsertWorldRegionSchema,
  transferRegionSchema,
  allocateShardSchema,
  transferShardSchema,
  upsertRegionalSimulationSchema,
  rebalanceWorldSchema,
  cleanupShardsSchema,
} from '@atc/operations'

export function orchestratorRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── World Regions ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/orchestrator/regions/upsert', async (req, reply) => {
    if (!ctx.worldOrchestratorService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertWorldRegionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const region = await ctx.worldOrchestratorService.registerRegion(parsed.data)
    return reply.code(200).send(region)
  })

  fastify.get('/api/v1/orchestrator/regions/active', async (_req, reply) => {
    if (!ctx.worldOrchestratorService) return reply.code(503).send({ error: 'Service unavailable' })
    const regions = await ctx.worldOrchestratorService.listRegions()
    return reply.code(200).send(regions)
  })

  fastify.post('/api/v1/orchestrator/regions/transfer', async (req, reply) => {
    if (!ctx.worldOrchestratorService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = transferRegionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const region = await ctx.worldOrchestratorService.transferRegion(
      parsed.data.regionId,
      parsed.data.fromServerId,
      parsed.data.toServerId,
    )
    return reply.code(200).send(region)
  })

  fastify.delete('/api/v1/orchestrator/regions/:regionId', async (req, reply) => {
    if (!ctx.worldOrchestratorService) return reply.code(503).send({ error: 'Service unavailable' })
    const { regionId } = req.params as { regionId: string }
    await ctx.worldOrchestratorService.deactivateRegion(regionId)
    return reply.code(204).send()
  })

  fastify.post('/api/v1/orchestrator/regions/recover', async (req, reply) => {
    if (!ctx.worldOrchestratorService) return reply.code(503).send({ error: 'Service unavailable' })
    const body = req.body as { regionId?: string }
    const result = await ctx.worldOrchestratorService.recover(body?.regionId)
    return reply.code(200).send(result)
  })

  // ── Shards ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/orchestrator/shards/allocate', async (req, reply) => {
    if (!ctx.distributedShardService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = allocateShardSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const shard = await ctx.distributedShardService.allocateShard(parsed.data)
    return reply.code(200).send(shard)
  })

  fastify.get('/api/v1/orchestrator/shards/active', async (_req, reply) => {
    if (!ctx.distributedShardService) return reply.code(503).send({ error: 'Service unavailable' })
    const shards = await ctx.distributedShardService.listActiveShards()
    return reply.code(200).send(shards)
  })

  fastify.post('/api/v1/orchestrator/shards/transfer', async (req, reply) => {
    if (!ctx.distributedShardService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = transferShardSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const shard = await ctx.distributedShardService.transferShard(
      parsed.data.shardId,
      parsed.data.fromServerId,
      parsed.data.toServerId,
    )
    return reply.code(200).send(shard)
  })

  fastify.post('/api/v1/orchestrator/shards/cleanup', async (req, reply) => {
    if (!ctx.distributedShardService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupShardsSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const count = await ctx.distributedShardService.cleanupStaleShards(parsed.data.thresholdMs)
    return reply.code(200).send({ count })
  })

  // ── Regional Simulations ────────────────────────────────────────────────────

  fastify.post('/api/v1/orchestrator/simulations/upsert', async (req, reply) => {
    if (!ctx.regionalSimulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertRegionalSimulationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const sim = await ctx.regionalSimulationService.startSimulation(parsed.data)
    return reply.code(200).send(sim)
  })

  fastify.get('/api/v1/orchestrator/simulations/active', async (_req, reply) => {
    if (!ctx.regionalSimulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const sims = await ctx.regionalSimulationService.listActiveSimulations()
    return reply.code(200).send(sims)
  })

  fastify.delete('/api/v1/orchestrator/simulations/:regionId', async (req, reply) => {
    if (!ctx.regionalSimulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { regionId } = req.params as { regionId: string }
    await ctx.regionalSimulationService.stopSimulation(regionId)
    return reply.code(204).send()
  })

  // ── Rebalancing ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/orchestrator/rebalance', async (req, reply) => {
    if (!ctx.runtimeBalancingService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = rebalanceWorldSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.runtimeBalancingService.rebalance(
      parsed.data.regionId,
      parsed.data.thresholdPercent,
    )
    return reply.code(200).send(result)
  })

  // ── World Recovery ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/orchestrator/recovery', async (req, reply) => {
    if (!ctx.persistentWorldRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const body = req.body as { shardId?: string; regionId?: string } | undefined
    const result = await ctx.persistentWorldRecoveryService.recover(body?.shardId, body?.regionId)
    return reply.code(200).send(result)
  })
}
