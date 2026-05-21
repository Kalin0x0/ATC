import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  adjustReputationSchema,
  upsertReputationSchema,
  setDiplomaticRelationSchema,
  adjustSocialStandingSchema,
  upsertSocialStandingSchema,
  scheduleDecaySchema,
  recordInfluenceSchema,
} from '@atc/operations'
import { ReputationRuntimeError } from '@atc/reputation-runtime'

function reputationErrorToStatus(err: ReputationRuntimeError): number {
  const name = err.constructor.name
  if (name === 'DuplicateDiplomaticRelationError') return 409
  if (name === 'InvalidReputationScoreError') return 422
  if (name.endsWith('NotFoundError')) return 404
  return 500
}

const NOT_CONFIGURED = { error: 'Reputation runtime not configured' }

export async function reputationRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Reputation ────────────────────────────────────────────────────────────

  fastify.post('/api/v1/reputation/adjust', {
    preHandler: requireCapability(ctx, 'reputation:write'),
    handler: async (req, reply) => {
      if (!ctx.reputationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = adjustReputationSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.reputationRuntimeService.adjustReputation(
          parsed.data.principalId,
          parsed.data.factionId,
          parsed.data.delta,
          parsed.data.reason,
          parsed.data.actorId,
        )
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof ReputationRuntimeError) return reply.status(reputationErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/reputation/upsert', {
    preHandler: requireCapability(ctx, 'reputation:write'),
    handler: async (req, reply) => {
      if (!ctx.reputationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = upsertReputationSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.reputationRuntimeService.updateReputation(
          parsed.data.principalId,
          parsed.data.factionId,
          parsed.data.reputationScore,
          parsed.data.tier,
        )
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof ReputationRuntimeError) return reply.status(reputationErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/reputation/:principalId/:factionId', {
    preHandler: requireCapability(ctx, 'reputation:read'),
    handler: async (req, reply) => {
      if (!ctx.reputationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { principalId, factionId } = req.params as { principalId: string; factionId: string }
      const result = await ctx.reputationRuntimeService.getReputation(principalId, factionId)
      if (result === null) return reply.status(404).send({ error: 'Reputation record not found' })
      return reply.status(200).send(result)
    },
  })

  // ── Diplomacy ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/reputation/diplomacy', {
    preHandler: requireCapability(ctx, 'reputation:write'),
    handler: async (req, reply) => {
      if (!ctx.diplomacyService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = setDiplomaticRelationSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.diplomacyService.setRelation(
          parsed.data.factionAId,
          parsed.data.factionBId,
          parsed.data.status,
          parsed.data.relationScore,
        )
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof ReputationRuntimeError) return reply.status(reputationErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/reputation/diplomacy/:factionAId/:factionBId', {
    preHandler: requireCapability(ctx, 'reputation:read'),
    handler: async (req, reply) => {
      if (!ctx.diplomacyService) return reply.status(503).send(NOT_CONFIGURED)
      const { factionAId, factionBId } = req.params as { factionAId: string; factionBId: string }
      const result = await ctx.diplomacyService.getRelation(factionAId, factionBId)
      if (result === null) return reply.status(404).send({ error: 'Diplomatic relation not found' })
      return reply.status(200).send(result)
    },
  })

  // ── Social Standing ───────────────────────────────────────────────────────

  fastify.post('/api/v1/reputation/standing/adjust', {
    preHandler: requireCapability(ctx, 'reputation:write'),
    handler: async (req, reply) => {
      if (!ctx.socialStandingService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = adjustSocialStandingSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.socialStandingService.adjustStanding(
          parsed.data.principalId,
          parsed.data.delta,
          parsed.data.reason,
        )
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof ReputationRuntimeError) return reply.status(reputationErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/reputation/standing/upsert', {
    preHandler: requireCapability(ctx, 'reputation:write'),
    handler: async (req, reply) => {
      if (!ctx.socialStandingService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = upsertSocialStandingSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.socialStandingService.updateStanding(
          parsed.data.principalId,
          parsed.data.standingScore,
          parsed.data.tier,
        )
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof ReputationRuntimeError) return reply.status(reputationErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/reputation/standing/:principalId', {
    preHandler: requireCapability(ctx, 'reputation:read'),
    handler: async (req, reply) => {
      if (!ctx.socialStandingService) return reply.status(503).send(NOT_CONFIGURED)
      const { principalId } = req.params as { principalId: string }
      const result = await ctx.socialStandingService.getStanding(principalId)
      if (result === null) return reply.status(404).send({ error: 'Social standing not found' })
      return reply.status(200).send(result)
    },
  })

  // ── Decay ─────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/reputation/decay/schedule', {
    preHandler: requireCapability(ctx, 'reputation:write'),
    handler: async (req, reply) => {
      if (!ctx.reputationDecayService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = scheduleDecaySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.reputationDecayService.scheduleDecay(
          parsed.data.principalId,
          parsed.data.factionId ?? null,
          parsed.data.decayRate,
          new Date(parsed.data.nextDecayAt),
        )
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof ReputationRuntimeError) return reply.status(reputationErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/reputation/decay/apply', {
    preHandler: requireCapability(ctx, 'reputation:write'),
    handler: async (_req, reply) => {
      if (!ctx.reputationDecayService) return reply.status(503).send(NOT_CONFIGURED)
      const count = await ctx.reputationDecayService.applyDueDecay()
      return reply.status(200).send({ processed: count })
    },
  })

  // ── Influence History ─────────────────────────────────────────────────────

  fastify.post('/api/v1/reputation/influence', {
    preHandler: requireCapability(ctx, 'reputation:write'),
    handler: async (req, reply) => {
      if (!ctx.influenceTrackingService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = recordInfluenceSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.influenceTrackingService.recordChange(
          parsed.data.principalId,
          parsed.data.changeAmount,
          parsed.data.changeType,
          parsed.data.changeReason,
          parsed.data.factionId,
          parsed.data.actorId,
        )
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof ReputationRuntimeError) return reply.status(reputationErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/reputation/influence/:principalId', {
    preHandler: requireCapability(ctx, 'reputation:read'),
    handler: async (req, reply) => {
      if (!ctx.influenceTrackingService) return reply.status(503).send(NOT_CONFIGURED)
      const { principalId } = req.params as { principalId: string }
      const result = await ctx.influenceTrackingService.getHistory(principalId)
      return reply.status(200).send(result)
    },
  })
}
