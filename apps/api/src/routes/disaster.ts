import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  declareDisasterSchema,
  updateDisasterStatusSchema,
  propagateHazardSchema,
  clearHazardZoneSchema,
  initiateEvacuationSchema,
  updateEvacuationProgressSchema,
  completeEvacuationSchema,
  dispatchResponseSchema,
  updateResponseStatusSchema,
  startRecoverySchema,
  updateRecoveryProgressSchema,
} from '@atc/operations'
import { DisasterRuntimeError } from '@atc/disaster-runtime'

function disasterErrorToStatus(err: DisasterRuntimeError): number {
  const name = err.constructor.name
  if (name === 'DuplicateDisasterNonceError' || name === 'DuplicateEvacuationNonceError') return 409
  if (name === 'DisasterAlreadyContainedError') return 422
  if (name.endsWith('NotFoundError')) return 404
  return 500
}

const NOT_CONFIGURED = { error: 'Disaster runtime not configured' }

export async function disasterRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Disaster Events ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/disaster/events', {
    preHandler: requireCapability(ctx, 'disaster:write'),
    handler: async (req, reply) => {
      if (!ctx.disasterRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = declareDisasterSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.disasterRuntimeService.declareDisaster({
          disasterNonce: parsed.data.disasterNonce,
          disasterType:  parsed.data.disasterType,
          disasterName:  parsed.data.disasterName,
          severity:      parsed.data.severity,
          ...(parsed.data.affectedZoneIds !== undefined ? { affectedZoneIds: parsed.data.affectedZoneIds } : {}),
          ...(parsed.data.initiatedByPrincipalId !== undefined ? { initiatedByPrincipalId: parsed.data.initiatedByPrincipalId } : {}),
          ...(parsed.data.ownerServerId !== undefined ? { ownerServerId: parsed.data.ownerServerId } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof DisasterRuntimeError) return reply.status(disasterErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/disaster/events', {
    preHandler: requireCapability(ctx, 'disaster:read'),
    handler: async (_req, reply) => {
      if (!ctx.disasterEventRepo) return reply.status(503).send(NOT_CONFIGURED)
      const events = await ctx.disasterEventRepo.listActive()
      return reply.status(200).send(events)
    },
  })

  fastify.post('/api/v1/disaster/events/:disasterId/escalate', {
    preHandler: requireCapability(ctx, 'disaster:write'),
    handler: async (req, reply) => {
      if (!ctx.disasterRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { disasterId } = req.params as { disasterId: string }
      const parsed = updateDisasterStatusSchema.safeParse({ disasterId, status: 'escalated' })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.disasterRuntimeService.escalateDisaster(disasterId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof DisasterRuntimeError) return reply.status(disasterErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/disaster/events/:disasterId/contain', {
    preHandler: requireCapability(ctx, 'disaster:write'),
    handler: async (req, reply) => {
      if (!ctx.disasterRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { disasterId } = req.params as { disasterId: string }
      try {
        const result = await ctx.disasterRuntimeService.containDisaster(disasterId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof DisasterRuntimeError) return reply.status(disasterErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/disaster/events/:disasterId/resolve', {
    preHandler: requireCapability(ctx, 'disaster:write'),
    handler: async (req, reply) => {
      if (!ctx.disasterRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { disasterId } = req.params as { disasterId: string }
      try {
        const result = await ctx.disasterRuntimeService.resolveDisaster(disasterId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof DisasterRuntimeError) return reply.status(disasterErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  // ── Hazard Zones ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/disaster/hazards', {
    preHandler: requireCapability(ctx, 'disaster:write'),
    handler: async (req, reply) => {
      if (!ctx.disasterRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = propagateHazardSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.disasterRuntimeService.propagateHazard({
          zoneId:     parsed.data.zoneId,
          hazardType: parsed.data.hazardType,
          severity:   parsed.data.severity,
          ...(parsed.data.disasterId !== undefined ? { disasterId: parsed.data.disasterId } : {}),
          ...(parsed.data.propagationRadius !== undefined ? { propagationRadius: parsed.data.propagationRadius } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof DisasterRuntimeError) return reply.status(disasterErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/disaster/hazards', {
    preHandler: requireCapability(ctx, 'disaster:read'),
    handler: async (_req, reply) => {
      if (!ctx.hazardZoneRepo) return reply.status(503).send(NOT_CONFIGURED)
      const zones = await ctx.hazardZoneRepo.listActive()
      return reply.status(200).send(zones)
    },
  })

  fastify.post('/api/v1/disaster/hazards/:zoneId/clear', {
    preHandler: requireCapability(ctx, 'disaster:write'),
    handler: async (req, reply) => {
      if (!ctx.disasterRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { zoneId } = req.params as { zoneId: string }
      const parsed = clearHazardZoneSchema.safeParse({ zoneId })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.disasterRuntimeService.clearHazardZone(parsed.data.zoneId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof DisasterRuntimeError) return reply.status(disasterErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  // ── Evacuations ───────────────────────────────────────────────────────────────

  fastify.post('/api/v1/disaster/evacuations', {
    preHandler: requireCapability(ctx, 'disaster:write'),
    handler: async (req, reply) => {
      if (!ctx.evacuationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = initiateEvacuationSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.evacuationRuntimeService.initiateEvacuation({
          evacuationNonce: parsed.data.evacuationNonce,
          zoneId:          parsed.data.zoneId,
          evacuationType:  parsed.data.evacuationType,
          ...(parsed.data.disasterId !== undefined ? { disasterId: parsed.data.disasterId } : {}),
          ...(parsed.data.targetCount !== undefined ? { targetCount: parsed.data.targetCount } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof DisasterRuntimeError) return reply.status(disasterErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/disaster/evacuations/:evacuationId/progress', {
    preHandler: requireCapability(ctx, 'disaster:write'),
    handler: async (req, reply) => {
      if (!ctx.evacuationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { evacuationId } = req.params as { evacuationId: string }
      const parsed = updateEvacuationProgressSchema.safeParse({ evacuationId, ...(req.body as object) })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.evacuationRuntimeService.updateProgress(parsed.data.evacuationId, parsed.data.evacuatedCount)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof DisasterRuntimeError) return reply.status(disasterErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/disaster/evacuations/:evacuationId/complete', {
    preHandler: requireCapability(ctx, 'disaster:write'),
    handler: async (req, reply) => {
      if (!ctx.evacuationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { evacuationId } = req.params as { evacuationId: string }
      const parsed = completeEvacuationSchema.safeParse({ evacuationId })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.evacuationRuntimeService.completeEvacuation(parsed.data.evacuationId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof DisasterRuntimeError) return reply.status(disasterErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/disaster/evacuations/:evacuationId/cancel', {
    preHandler: requireCapability(ctx, 'disaster:write'),
    handler: async (req, reply) => {
      if (!ctx.evacuationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { evacuationId } = req.params as { evacuationId: string }
      try {
        const result = await ctx.evacuationRuntimeService.cancelEvacuation(evacuationId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof DisasterRuntimeError) return reply.status(disasterErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  // ── Emergency Response ────────────────────────────────────────────────────────

  fastify.post('/api/v1/disaster/responses', {
    preHandler: requireCapability(ctx, 'disaster:write'),
    handler: async (req, reply) => {
      if (!ctx.emergencyResponseService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = dispatchResponseSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.emergencyResponseService.dispatchResponse({
          responseType: parsed.data.responseType,
          ...(parsed.data.disasterId !== undefined ? { disasterId: parsed.data.disasterId } : {}),
          ...(parsed.data.responderPrincipalId !== undefined ? { responderPrincipalId: parsed.data.responderPrincipalId } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof DisasterRuntimeError) return reply.status(disasterErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/disaster/responses/:responseId/arrive', {
    preHandler: requireCapability(ctx, 'disaster:write'),
    handler: async (req, reply) => {
      if (!ctx.emergencyResponseService) return reply.status(503).send(NOT_CONFIGURED)
      const { responseId } = req.params as { responseId: string }
      const parsed = updateResponseStatusSchema.safeParse({ responseId, status: 'on_scene' })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.emergencyResponseService.arriveOnScene(responseId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof DisasterRuntimeError) return reply.status(disasterErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/disaster/responses/:responseId/complete', {
    preHandler: requireCapability(ctx, 'disaster:write'),
    handler: async (req, reply) => {
      if (!ctx.emergencyResponseService) return reply.status(503).send(NOT_CONFIGURED)
      const { responseId } = req.params as { responseId: string }
      try {
        const result = await ctx.emergencyResponseService.completeResponse(responseId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof DisasterRuntimeError) return reply.status(disasterErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/disaster/responses/:responseId/withdraw', {
    preHandler: requireCapability(ctx, 'disaster:write'),
    handler: async (req, reply) => {
      if (!ctx.emergencyResponseService) return reply.status(503).send(NOT_CONFIGURED)
      const { responseId } = req.params as { responseId: string }
      try {
        const result = await ctx.emergencyResponseService.withdrawResponse(responseId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof DisasterRuntimeError) return reply.status(disasterErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  // ── Recovery ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/disaster/recovery', {
    preHandler: requireCapability(ctx, 'disaster:write'),
    handler: async (req, reply) => {
      if (!ctx.recoveryOrchestrationService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = startRecoverySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.recoveryOrchestrationService.startRecovery(parsed.data.disasterId, {
          recoveryPhase:   parsed.data.recoveryPhase,
          progressPercent: parsed.data.progressPercent,
          ...(parsed.data.estimatedCompletionAt !== undefined ? { estimatedCompletionAt: new Date(parsed.data.estimatedCompletionAt) } : {}),
        })
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof DisasterRuntimeError) return reply.status(disasterErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/disaster/recovery/:disasterId/progress', {
    preHandler: requireCapability(ctx, 'disaster:write'),
    handler: async (req, reply) => {
      if (!ctx.recoveryOrchestrationService) return reply.status(503).send(NOT_CONFIGURED)
      const { disasterId } = req.params as { disasterId: string }
      const parsed = updateRecoveryProgressSchema.safeParse({ disasterId, ...(req.body as object) })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.recoveryOrchestrationService.updateProgress(parsed.data.disasterId, parsed.data.progressPercent)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof DisasterRuntimeError) return reply.status(disasterErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })
}
