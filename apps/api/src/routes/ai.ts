import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  upsertAiEntitySchema,
  updateAiStateSchema,
  startPatrolSchema,
  completePatrolSchema,
  assessThreatSchema,
  requestReinforcementSchema,
  activateTacticalResponseSchema,
  updateReinforcementStatusSchema,
  recoverAiEntitySchema,
  cleanupAiRuntimeSchema,
} from '@atc/operations'
import { AiRuntimeError } from '@atc/ai-runtime'

function aiErrorToStatus(err: AiRuntimeError): number {
  const name = err.constructor.name
  if (name === 'DuplicatePatrolNonceError' || name === 'DuplicateReinforcementNonceError') return 409
  if (name === 'PatrolAlreadyActiveError' || name === 'AiResponseAlreadyActiveError') return 422
  if (name.endsWith('NotFoundError')) return 404
  return 500
}

const NOT_CONFIGURED = { error: 'AI runtime not configured' }

export async function aiRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── AI Entities ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/ai/entities', {
    preHandler: requireCapability(ctx, 'ai:write'),
    handler: async (req, reply) => {
      if (!ctx.aiRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = upsertAiEntitySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.aiRuntimeService.registerEntity({
          entityId:     parsed.data.entityId,
          entityType:   parsed.data.entityType,
          ...(parsed.data.aiState !== undefined ? { aiState: parsed.data.aiState } : {}),
          ...(parsed.data.behaviorMode !== undefined ? { behaviorMode: parsed.data.behaviorMode } : {}),
          ...(parsed.data.ownerServerId !== undefined ? { ownerServerId: parsed.data.ownerServerId } : {}),
          ...(parsed.data.positionData !== undefined ? { positionData: parsed.data.positionData } : {}),
          ...(parsed.data.threatLevel !== undefined ? { threatLevel: parsed.data.threatLevel } : {}),
        })
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof AiRuntimeError) return reply.status(aiErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/ai/entities', {
    preHandler: requireCapability(ctx, 'ai:read'),
    handler: async (_req, reply) => {
      if (!ctx.aiRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const result = await ctx.aiRuntimeService.listActiveEntities()
      return reply.status(200).send(result)
    },
  })

  fastify.post('/api/v1/ai/entities/state', {
    preHandler: requireCapability(ctx, 'ai:write'),
    handler: async (req, reply) => {
      if (!ctx.aiRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = updateAiStateSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.aiRuntimeService.updateEntityState(parsed.data.entityId, parsed.data.aiState)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof AiRuntimeError) return reply.status(aiErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/ai/entities/recover', {
    preHandler: requireCapability(ctx, 'ai:write'),
    handler: async (req, reply) => {
      if (!ctx.aiRecoveryService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = recoverAiEntitySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.aiRecoveryService.recoverEntity(parsed.data.entityId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof AiRuntimeError) return reply.status(aiErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/ai/cleanup', {
    preHandler: requireCapability(ctx, 'ai:write'),
    handler: async (req, reply) => {
      if (!ctx.aiRecoveryService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = cleanupAiRuntimeSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      const result = await ctx.aiRecoveryService.fullCleanup(parsed.data.thresholdMs)
      return reply.status(200).send(result)
    },
  })

  // ── Patrols ───────────────────────────────────────────────────────────────

  fastify.post('/api/v1/ai/patrols', {
    preHandler: requireCapability(ctx, 'ai:write'),
    handler: async (req, reply) => {
      if (!ctx.autonomousPatrolService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = startPatrolSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.autonomousPatrolService.startPatrol({
          patrolNonce:  parsed.data.patrolNonce,
          entityId:     parsed.data.entityId,
          patrolType:   parsed.data.patrolType,
          ...(parsed.data.routeData !== undefined ? { routeData: parsed.data.routeData } : {}),
          ...(parsed.data.ownerServerId !== undefined ? { ownerServerId: parsed.data.ownerServerId } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof AiRuntimeError) return reply.status(aiErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/ai/patrols', {
    preHandler: requireCapability(ctx, 'ai:read'),
    handler: async (_req, reply) => {
      if (!ctx.autonomousPatrolService) return reply.status(503).send(NOT_CONFIGURED)
      const result = await ctx.autonomousPatrolService.listActivePatrols()
      return reply.status(200).send(result)
    },
  })

  fastify.post('/api/v1/ai/patrols/:patrolId/complete', {
    preHandler: requireCapability(ctx, 'ai:write'),
    handler: async (req, reply) => {
      if (!ctx.autonomousPatrolService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = completePatrolSchema.safeParse({ patrolId: (req.params as { patrolId: string }).patrolId })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.autonomousPatrolService.completePatrol(parsed.data.patrolId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof AiRuntimeError) return reply.status(aiErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  // ── Threats ───────────────────────────────────────────────────────────────

  fastify.post('/api/v1/ai/threats', {
    preHandler: requireCapability(ctx, 'ai:write'),
    handler: async (req, reply) => {
      if (!ctx.threatAssessmentService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = assessThreatSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.threatAssessmentService.assessThreat({
          entityId:     parsed.data.entityId,
          threatLevel:  parsed.data.threatLevel,
          threatType:   parsed.data.threatType,
          ...(parsed.data.assessmentId !== undefined ? { assessmentId: parsed.data.assessmentId } : {}),
          ...(parsed.data.threatSourceId !== undefined ? { threatSourceId: parsed.data.threatSourceId } : {}),
          ...(parsed.data.assessmentData !== undefined ? { assessmentData: parsed.data.assessmentData } : {}),
          ...(parsed.data.expiresAt !== undefined ? { expiresAt: new Date(parsed.data.expiresAt) } : {}),
        })
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof AiRuntimeError) return reply.status(aiErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/ai/threats', {
    preHandler: requireCapability(ctx, 'ai:read'),
    handler: async (_req, reply) => {
      if (!ctx.threatAssessmentService) return reply.status(503).send(NOT_CONFIGURED)
      const result = await ctx.threatAssessmentService.listActiveThreats()
      return reply.status(200).send(result)
    },
  })

  // ── Reinforcements ────────────────────────────────────────────────────────

  fastify.post('/api/v1/ai/reinforcements', {
    preHandler: requireCapability(ctx, 'ai:write'),
    handler: async (req, reply) => {
      if (!ctx.reinforcementCoordinationService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = requestReinforcementSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.reinforcementCoordinationService.requestReinforcement({
          reinforcementNonce: parsed.data.reinforcementNonce,
          reinforcementType:  parsed.data.reinforcementType,
          ...(parsed.data.requestingEntityId !== undefined ? { requestingEntityId: parsed.data.requestingEntityId } : {}),
          ...(parsed.data.quantity !== undefined ? { quantity: parsed.data.quantity } : {}),
          ...(parsed.data.ownerServerId !== undefined ? { ownerServerId: parsed.data.ownerServerId } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof AiRuntimeError) return reply.status(aiErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/ai/reinforcements', {
    preHandler: requireCapability(ctx, 'ai:read'),
    handler: async (_req, reply) => {
      if (!ctx.aiReinforcementRepo) return reply.status(503).send(NOT_CONFIGURED)
      const result = await ctx.aiReinforcementRepo.listActive()
      return reply.status(200).send(result)
    },
  })

  fastify.post('/api/v1/ai/reinforcements/:reinforcementId/status', {
    preHandler: requireCapability(ctx, 'ai:write'),
    handler: async (req, reply) => {
      if (!ctx.reinforcementCoordinationService) return reply.status(503).send(NOT_CONFIGURED)
      const params = req.params as { reinforcementId: string }
      const parsed = updateReinforcementStatusSchema.safeParse({ ...req.body as object, reinforcementId: params.reinforcementId })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        let result
        const svc = ctx.reinforcementCoordinationService
        if (parsed.data.status === 'dispatched') result = await svc.dispatchReinforcement(parsed.data.reinforcementId)
        else if (parsed.data.status === 'arrived') result = await svc.arriveReinforcement(parsed.data.reinforcementId)
        else if (parsed.data.status === 'withdrawn') result = await svc.withdrawReinforcement(parsed.data.reinforcementId)
        else result = await svc.cancelReinforcement(parsed.data.reinforcementId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof AiRuntimeError) return reply.status(aiErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  // ── Tactical Responses ────────────────────────────────────────────────────

  fastify.post('/api/v1/ai/responses', {
    preHandler: requireCapability(ctx, 'ai:write'),
    handler: async (req, reply) => {
      if (!ctx.tacticalResponseService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = activateTacticalResponseSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.tacticalResponseService.activateResponse({
          entityId:     parsed.data.entityId,
          responseType: parsed.data.responseType,
          ...(parsed.data.targetId !== undefined ? { targetId: parsed.data.targetId } : {}),
          ...(parsed.data.tacticalData !== undefined ? { tacticalData: parsed.data.tacticalData } : {}),
          ...(parsed.data.ownerServerId !== undefined ? { ownerServerId: parsed.data.ownerServerId } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof AiRuntimeError) return reply.status(aiErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/ai/responses/:entityId', {
    preHandler: requireCapability(ctx, 'ai:read'),
    handler: async (req, reply) => {
      if (!ctx.tacticalResponseService) return reply.status(503).send(NOT_CONFIGURED)
      const { entityId } = req.params as { entityId: string }
      const result = await ctx.tacticalResponseService.listActiveByEntity(entityId)
      return reply.status(200).send(result)
    },
  })
}
