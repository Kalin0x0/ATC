import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  registerCraftingRecipeSchema,
  acquireBlueprintSchema,
  registerStationSchema,
  startProductionJobSchema,
  completeProductionJobSchema,
  failProductionJobSchema,
  cancelProductionJobSchema,
} from '@atc/operations'
import { CraftingRuntimeError } from '@atc/crafting-runtime'

function craftingErrorToStatus(err: CraftingRuntimeError): number {
  const name = err.constructor.name
  if (
    name === 'BlueprintAlreadyOwnedError' ||
    name === 'DuplicateJobNonceError' ||
    name === 'ProductionJobAlreadyActiveError'
  ) return 409
  if (
    name === 'ProductionJobNotActiveError' ||
    name === 'ManufacturingQueueOfflineError'
  ) return 422
  if (name.endsWith('NotFoundError')) return 404
  return 500
}

const NOT_CONFIGURED = { error: 'Crafting runtime not configured' }

export async function craftingRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Register crafting recipe ──────────────────────────────────────────────────

  fastify.post('/api/v1/crafting/recipes', {
    preHandler: requireCapability(ctx, 'crafting:write'),
    handler: async (req, reply) => {
      if (!ctx.craftingRecipeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = registerCraftingRecipeSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.craftingRecipeService.registerRecipe({
          recipeId:            parsed.data.recipeId,
          recipeName:          parsed.data.recipeName,
          outputItemId:        parsed.data.outputItemId,
          outputQuantity:      parsed.data.outputQuantity,
          recipeType:          parsed.data.recipeType,
          craftingTimeSeconds: parsed.data.craftingTimeSeconds,
          ...(parsed.data.requiredStation !== undefined   ? { requiredStation: parsed.data.requiredStation }     : {}),
          ...(parsed.data.isDiscoverable !== undefined    ? { isDiscoverable: parsed.data.isDiscoverable }       : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof CraftingRuntimeError) return reply.status(craftingErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── List all recipes ──────────────────────────────────────────────────────────

  fastify.get('/api/v1/crafting/recipes', {
    preHandler: requireCapability(ctx, 'crafting:read'),
    handler: async (req, reply) => {
      if (!ctx.craftingRecipeService) return reply.status(503).send(NOT_CONFIGURED)
      const recipes = await ctx.craftingRecipeService.listActiveRecipes()
      return reply.send({ recipes })
    },
  })

  // ── Acquire blueprint ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/crafting/blueprints', {
    preHandler: requireCapability(ctx, 'crafting:write'),
    handler: async (req, reply) => {
      if (!ctx.blueprintService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = acquireBlueprintSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.blueprintService.acquireBlueprint(
          parsed.data.principalId,
          parsed.data.recipeId,
          parsed.data.source,
        )
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof CraftingRuntimeError) return reply.status(craftingErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── List blueprints for principal ─────────────────────────────────────────────

  fastify.get('/api/v1/crafting/blueprints/:principalId', {
    preHandler: requireCapability(ctx, 'crafting:read'),
    handler: async (req, reply) => {
      if (!ctx.blueprintService) return reply.status(503).send(NOT_CONFIGURED)
      const { principalId } = req.params as { principalId: string }
      const blueprints = await ctx.blueprintService.listBlueprints(principalId)
      return reply.send({ blueprints })
    },
  })

  // ── Register manufacturing station ────────────────────────────────────────────

  fastify.post('/api/v1/crafting/stations', {
    preHandler: requireCapability(ctx, 'crafting:write'),
    handler: async (req, reply) => {
      if (!ctx.manufacturingQueueService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = registerStationSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      const result = await ctx.manufacturingQueueService.registerStation(
        parsed.data.stationId,
        parsed.data.stationType,
      )
      return reply.status(201).send(result)
    },
  })

  // ── Start production job ──────────────────────────────────────────────────────

  fastify.post('/api/v1/crafting/jobs', {
    preHandler: requireCapability(ctx, 'crafting:write'),
    handler: async (req, reply) => {
      if (!ctx.productionJobService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = startProductionJobSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.productionJobService.startJob({
          queueId:                parsed.data.queueId,
          recipeId:               parsed.data.recipeId,
          initiatedByPrincipalId: parsed.data.initiatedByPrincipalId,
          quantityOrdered:        parsed.data.quantityOrdered,
          jobNonce:               parsed.data.jobNonce,
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof CraftingRuntimeError) return reply.status(craftingErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get production job ────────────────────────────────────────────────────────

  fastify.get('/api/v1/crafting/jobs/:jobId', {
    preHandler: requireCapability(ctx, 'crafting:read'),
    handler: async (req, reply) => {
      if (!ctx.productionJobService) return reply.status(503).send(NOT_CONFIGURED)
      const { jobId } = req.params as { jobId: string }
      const job = await ctx.productionJobService.getJob(jobId)
      if (!job) return reply.status(404).send({ error: 'ProductionJobNotFound' })
      return reply.send(job)
    },
  })

  // ── Complete production job ───────────────────────────────────────────────────

  fastify.post('/api/v1/crafting/jobs/:jobId/complete', {
    preHandler: requireCapability(ctx, 'crafting:write'),
    handler: async (req, reply) => {
      if (!ctx.productionJobService) return reply.status(503).send(NOT_CONFIGURED)
      const { jobId } = req.params as { jobId: string }
      const parsed = completeProductionJobSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.productionJobService.completeJob(jobId, parsed.data.quantityProduced)
        return reply.send(result)
      } catch (err) {
        if (err instanceof CraftingRuntimeError) return reply.status(craftingErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Fail production job ───────────────────────────────────────────────────────

  fastify.post('/api/v1/crafting/jobs/:jobId/fail', {
    preHandler: requireCapability(ctx, 'crafting:write'),
    handler: async (req, reply) => {
      if (!ctx.productionJobService) return reply.status(503).send(NOT_CONFIGURED)
      const { jobId } = req.params as { jobId: string }
      const parsed = failProductionJobSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.productionJobService.failJob(jobId, parsed.data.reason)
        return reply.send(result)
      } catch (err) {
        if (err instanceof CraftingRuntimeError) return reply.status(craftingErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Cancel production job ─────────────────────────────────────────────────────

  fastify.post('/api/v1/crafting/jobs/:jobId/cancel', {
    preHandler: requireCapability(ctx, 'crafting:write'),
    handler: async (req, reply) => {
      if (!ctx.productionJobService) return reply.status(503).send(NOT_CONFIGURED)
      const { jobId } = req.params as { jobId: string }
      const parsed = cancelProductionJobSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.productionJobService.cancelJob(jobId, parsed.data.cancelledBy)
        return reply.send(result)
      } catch (err) {
        if (err instanceof CraftingRuntimeError) return reply.status(craftingErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── List active jobs for station ──────────────────────────────────────────────

  fastify.get('/api/v1/crafting/stations/:stationId/jobs', {
    preHandler: requireCapability(ctx, 'crafting:read'),
    handler: async (req, reply) => {
      if (!ctx.productionJobService) return reply.status(503).send(NOT_CONFIGURED)
      const { stationId } = req.params as { stationId: string }
      const jobs = await ctx.productionJobService.listActiveJobs(stationId)
      return reply.send({ jobs })
    },
  })
}
