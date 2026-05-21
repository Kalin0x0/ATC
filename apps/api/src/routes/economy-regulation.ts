import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  createEconomyRegulationSchema,
  startResourceBalancingSchema,
  upsertInflationSchema,
  upsertTaxRateSchema,
  startMarketStabilizationSchema,
  cleanupEconomyRegulationSchema,
} from '@atc/operations'

export function economyRegulationRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Economy Regulation ───────────────────────────────────────────────────────

  fastify.post('/api/v1/economy-regulation/regulations/create', async (req, reply) => {
    if (!ctx.economyRegulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createEconomyRegulationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { regionId, regulationData, expiresAt, ...rest } = parsed.data
    const regulation = await ctx.economyRegulationService.createRegulation({
      ...rest,
      ...(regionId !== undefined ? { regionId } : {}),
      ...(regulationData !== undefined ? { regulationData } : {}),
      ...(expiresAt !== undefined ? { expiresAt: new Date(expiresAt) } : {}),
    })
    return reply.code(200).send(regulation)
  })

  fastify.post('/api/v1/economy-regulation/regulations/:id/suspend', async (req, reply) => {
    if (!ctx.economyRegulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const regulation = await ctx.economyRegulationService.suspendRegulation(id)
    return reply.code(200).send(regulation)
  })

  fastify.get('/api/v1/economy-regulation/regulations/:id', async (req, reply) => {
    if (!ctx.economyRegulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const regulation = await ctx.economyRegulationService.getRegulation(id)
    if (!regulation) return reply.code(404).send({ error: 'Regulation not found' })
    return reply.code(200).send(regulation)
  })

  fastify.get('/api/v1/economy-regulation/regulations/active', async (req, reply) => {
    if (!ctx.economyRegulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { ownerServerId } = req.query as { ownerServerId?: string }
    const regulations = await ctx.economyRegulationService.listActiveRegulations(ownerServerId)
    return reply.code(200).send(regulations)
  })

  // ── Resource Balancing ───────────────────────────────────────────────────────

  fastify.post('/api/v1/economy-regulation/balancing/start', async (req, reply) => {
    if (!ctx.resourceBalancingService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startResourceBalancingSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { targetRegionId, balancingData, ...rest } = parsed.data
    const balancing = await ctx.resourceBalancingService.startBalancing({
      ...rest,
      ...(targetRegionId !== undefined ? { targetRegionId } : {}),
      ...(balancingData !== undefined ? { balancingData } : {}),
    })
    return reply.code(200).send(balancing)
  })

  fastify.post('/api/v1/economy-regulation/balancing/:id/complete', async (req, reply) => {
    if (!ctx.resourceBalancingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const balancing = await ctx.resourceBalancingService.completeBalancing(id)
    return reply.code(200).send(balancing)
  })

  fastify.post('/api/v1/economy-regulation/balancing/:id/fail', async (req, reply) => {
    if (!ctx.resourceBalancingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const balancing = await ctx.resourceBalancingService.failBalancing(id)
    return reply.code(200).send(balancing)
  })

  fastify.get('/api/v1/economy-regulation/balancing/:id', async (req, reply) => {
    if (!ctx.resourceBalancingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const balancing = await ctx.resourceBalancingService.getBalancing(id)
    if (!balancing) return reply.code(404).send({ error: 'Balancing not found' })
    return reply.code(200).send(balancing)
  })

  // ── Inflation Control ────────────────────────────────────────────────────────

  fastify.post('/api/v1/economy-regulation/inflation', async (req, reply) => {
    if (!ctx.inflationControlService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertInflationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { inflationData, ...rest } = parsed.data
    const inflation = await ctx.inflationControlService.upsertInflation({
      ...rest,
      ...(inflationData !== undefined ? { inflationData } : {}),
    })
    return reply.code(200).send(inflation)
  })

  fastify.get('/api/v1/economy-regulation/inflation/:regionId', async (req, reply) => {
    if (!ctx.inflationControlService) return reply.code(503).send({ error: 'Service unavailable' })
    const { regionId } = req.params as { regionId: string }
    const inflation = await ctx.inflationControlService.getInflation(regionId)
    if (!inflation) return reply.code(404).send({ error: 'Inflation data not found' })
    return reply.code(200).send(inflation)
  })

  // ── Tax Adjustment ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/economy-regulation/tax', async (req, reply) => {
    if (!ctx.autonomousTaxAdjustmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertTaxRateSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { taxData, ...rest } = parsed.data
    const tax = await ctx.autonomousTaxAdjustmentService.upsertTaxRate({
      ...rest,
      ...(taxData !== undefined ? { taxData } : {}),
    })
    return reply.code(200).send(tax)
  })

  fastify.get('/api/v1/economy-regulation/tax/:regionId', async (req, reply) => {
    if (!ctx.autonomousTaxAdjustmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const { regionId } = req.params as { regionId: string }
    const tax = await ctx.autonomousTaxAdjustmentService.getTaxRate(regionId)
    if (!tax) return reply.code(404).send({ error: 'Tax rate not found' })
    return reply.code(200).send(tax)
  })

  // ── Market Stabilization ─────────────────────────────────────────────────────

  fastify.post('/api/v1/economy-regulation/stabilize', async (req, reply) => {
    if (!ctx.marketStabilizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startMarketStabilizationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { regionId, stabilizationData, ...rest } = parsed.data
    const stabilization = await ctx.marketStabilizationService.startStabilization({
      ...rest,
      ...(regionId !== undefined ? { regionId } : {}),
      ...(stabilizationData !== undefined ? { stabilizationData } : {}),
    })
    return reply.code(200).send(stabilization)
  })

  fastify.post('/api/v1/economy-regulation/stabilizations/:id/complete', async (req, reply) => {
    if (!ctx.marketStabilizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const stabilization = await ctx.marketStabilizationService.completeStabilization(id)
    return reply.code(200).send(stabilization)
  })

  fastify.post('/api/v1/economy-regulation/stabilizations/:id/fail', async (req, reply) => {
    if (!ctx.marketStabilizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const stabilization = await ctx.marketStabilizationService.failStabilization(id)
    return reply.code(200).send(stabilization)
  })

  fastify.get('/api/v1/economy-regulation/stabilizations/:id', async (req, reply) => {
    if (!ctx.marketStabilizationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const stabilization = await ctx.marketStabilizationService.getStabilization(id)
    if (!stabilization) return reply.code(404).send({ error: 'Stabilization not found' })
    return reply.code(200).send(stabilization)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/economy-regulation/cleanup', async (req, reply) => {
    if (!ctx.economicRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupEconomyRegulationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.economicRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
