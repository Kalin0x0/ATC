import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  survivalTickSchema,
  applyPenaltySchema,
  reconcileSurvivalSchema,
  recordDrinkSchema,
  recordRestSchema,
  createHazardSchema,
  deactivateHazardSchema,
  recordExposureSchema,
} from '@atc/operations'
import { SurvivalRuntimeError } from '@atc/survival-runtime'

function survivalErrorToStatus(err: SurvivalRuntimeError): number {
  const name = err.constructor.name
  if (name === 'HazardAlreadyActiveError') return 409
  if (name.endsWith('NotFoundError')) return 404
  return 500
}

const NOT_CONFIGURED = { error: 'Survival runtime not configured' }

export async function survivalRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Survival tick ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/survival/tick', {
    preHandler: requireCapability(ctx, 'survival:write'),
    handler: async (req, reply) => {
      if (!ctx.survivalRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = survivalTickSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.survivalRuntimeService.tick(
          parsed.data.playerId,
          parsed.data.ownerServerId,
          {
            bodyTemp:        parsed.data.bodyTemp,
            hydrationLevel:  parsed.data.hydrationLevel,
            fatigueLevel:    parsed.data.fatigueLevel,
            survivalStatus:  parsed.data.survivalStatus,
            ...(parsed.data.tempTrend !== undefined      ? { tempTrend: parsed.data.tempTrend }           : {}),
            ...(parsed.data.depletionRate !== undefined  ? { depletionRate: parsed.data.depletionRate }   : {}),
            ...(parsed.data.restDebt !== undefined       ? { restDebt: parsed.data.restDebt }             : {}),
            ...(parsed.data.exposureZone !== undefined   ? { exposureZone: parsed.data.exposureZone }     : {}),
          },
        )
        return reply.send(result)
      } catch (err) {
        if (err instanceof SurvivalRuntimeError) return reply.status(survivalErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Apply penalty ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/survival/penalty', {
    preHandler: requireCapability(ctx, 'survival:write'),
    handler: async (req, reply) => {
      if (!ctx.survivalRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = applyPenaltySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.survivalRuntimeService.applyPenalty(
          parsed.data.playerId,
          parsed.data.penaltyFlag,
          parsed.data.reason,
        )
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof SurvivalRuntimeError) return reply.status(survivalErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Reconcile stale survival states ──────────────────────────────────────────

  fastify.post('/api/v1/survival/reconcile', {
    preHandler: requireCapability(ctx, 'survival:write'),
    handler: async (req, reply) => {
      if (!ctx.survivalRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = reconcileSurvivalSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      const deleted = await ctx.survivalRuntimeService.reconcile(parsed.data.activePlayerIds)
      return reply.send({ deleted })
    },
  })

  // ── Get survival state ────────────────────────────────────────────────────────

  fastify.get('/api/v1/survival/players/:playerId', {
    preHandler: requireCapability(ctx, 'survival:read'),
    handler: async (req, reply) => {
      if (!ctx.survivalRuntimeRepo) return reply.status(503).send(NOT_CONFIGURED)
      const { playerId } = req.params as { playerId: string }
      const state = await ctx.survivalRuntimeRepo.findByPlayerId(playerId)
      if (!state) return reply.status(404).send({ error: 'SurvivalStateNotFound' })
      return reply.send(state)
    },
  })

  // ── Record drink ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/survival/hydration/drink', {
    preHandler: requireCapability(ctx, 'survival:write'),
    handler: async (req, reply) => {
      if (!ctx.hydrationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = recordDrinkSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.hydrationRuntimeService.recordDrink(parsed.data.playerId, parsed.data.amount)
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof SurvivalRuntimeError) return reply.status(survivalErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Record rest ───────────────────────────────────────────────────────────────

  fastify.post('/api/v1/survival/fatigue/rest', {
    preHandler: requireCapability(ctx, 'survival:write'),
    handler: async (req, reply) => {
      if (!ctx.fatigueRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = recordRestSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.fatigueRuntimeService.recordRest(parsed.data.playerId, parsed.data.recoveryAmount)
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof SurvivalRuntimeError) return reply.status(survivalErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Create environmental hazard ───────────────────────────────────────────────

  fastify.post('/api/v1/survival/hazards', {
    preHandler: requireCapability(ctx, 'survival:write'),
    handler: async (req, reply) => {
      if (!ctx.environmentalHazardService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = createHazardSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.environmentalHazardService.createHazard(
          parsed.data.hazardId,
          parsed.data.hazardType,
          parsed.data.zoneId,
          parsed.data.severity,
          parsed.data.ownerServerId,
        )
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof SurvivalRuntimeError) return reply.status(survivalErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Deactivate hazard ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/survival/hazards/:hazardId/deactivate', {
    preHandler: requireCapability(ctx, 'survival:write'),
    handler: async (req, reply) => {
      if (!ctx.environmentalHazardService) return reply.status(503).send(NOT_CONFIGURED)
      const { hazardId } = req.params as { hazardId: string }
      try {
        const result = await ctx.environmentalHazardService.deactivateHazard(hazardId)
        return reply.send(result)
      } catch (err) {
        if (err instanceof SurvivalRuntimeError) return reply.status(survivalErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── List active hazards ───────────────────────────────────────────────────────

  fastify.get('/api/v1/survival/hazards', {
    preHandler: requireCapability(ctx, 'survival:read'),
    handler: async (req, reply) => {
      if (!ctx.environmentalHazardService) return reply.status(503).send(NOT_CONFIGURED)
      const hazards = await ctx.environmentalHazardService.getActiveHazards()
      return reply.send({ hazards })
    },
  })

  // ── Record exposure ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/survival/exposure', {
    preHandler: requireCapability(ctx, 'survival:write'),
    handler: async (req, reply) => {
      if (!ctx.environmentalHazardService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = recordExposureSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.environmentalHazardService.recordExposure(
          parsed.data.playerId,
          parsed.data.hazardId,
          parsed.data.exposureType,
          parsed.data.severity,
        )
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof SurvivalRuntimeError) return reply.status(survivalErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })
}
