import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  createMissionSchema,
  startMissionSchema,
  completeMissionSchema,
  failMissionSchema,
  createObjectiveSchema,
  completeObjectiveSchema,
  assignMissionSchema,
  releaseMissionAssignmentSchema,
  registerScenarioSchema,
  createDynamicEventSchema,
  resolveEventSchema,
  progressMissionSchema,
} from '@atc/operations'
import { MissionRuntimeError } from '@atc/mission-runtime'

function missionErrorToStatus(err: MissionRuntimeError): number {
  const name = err.constructor.name
  if (name === 'DuplicateMissionNonceError' || name === 'AssignmentAlreadyExistsError' || name === 'DuplicateEventNonceError') return 409
  if (name === 'MissionAlreadyCompletedError') return 422
  if (name.endsWith('NotFoundError')) return 404
  return 500
}

const NOT_CONFIGURED = { error: 'Mission runtime not configured' }

export async function missionRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Missions ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/missions', {
    preHandler: requireCapability(ctx, 'mission:write'),
    handler: async (req, reply) => {
      if (!ctx.missionRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = createMissionSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.missionRuntimeService.createMission({
          missionNonce: parsed.data.missionNonce,
          missionType:  parsed.data.missionType,
          missionName:  parsed.data.missionName,
          ...(parsed.data.ownerServerId !== undefined ? { ownerServerId: parsed.data.ownerServerId } : {}),
          ...(parsed.data.ownerPrincipalId !== undefined ? { ownerPrincipalId: parsed.data.ownerPrincipalId } : {}),
          ...(parsed.data.configData !== undefined ? { configData: parsed.data.configData } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof MissionRuntimeError) return reply.status(missionErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/missions', {
    preHandler: requireCapability(ctx, 'mission:read'),
    handler: async (_req, reply) => {
      if (!ctx.missionRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const result = await ctx.missionRuntimeService.listActiveMissions()
      return reply.status(200).send(result)
    },
  })

  fastify.post('/api/v1/missions/:missionId/start', {
    preHandler: requireCapability(ctx, 'mission:write'),
    handler: async (req, reply) => {
      if (!ctx.missionRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = startMissionSchema.safeParse({ missionId: (req.params as { missionId: string }).missionId })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.missionRuntimeService.startMission(parsed.data.missionId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof MissionRuntimeError) return reply.status(missionErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/missions/:missionId/complete', {
    preHandler: requireCapability(ctx, 'mission:write'),
    handler: async (req, reply) => {
      if (!ctx.missionRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = completeMissionSchema.safeParse({ missionId: (req.params as { missionId: string }).missionId })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.missionRuntimeService.completeMission(parsed.data.missionId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof MissionRuntimeError) return reply.status(missionErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/missions/:missionId/fail', {
    preHandler: requireCapability(ctx, 'mission:write'),
    handler: async (req, reply) => {
      if (!ctx.missionRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = failMissionSchema.safeParse({ missionId: (req.params as { missionId: string }).missionId })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.missionRuntimeService.failMission(parsed.data.missionId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof MissionRuntimeError) return reply.status(missionErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  // ── Objectives ────────────────────────────────────────────────────────────

  fastify.post('/api/v1/missions/objectives', {
    preHandler: requireCapability(ctx, 'mission:write'),
    handler: async (req, reply) => {
      if (!ctx.objectiveTrackingService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = createObjectiveSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.objectiveTrackingService.createObjective({
          objectiveId:    parsed.data.objectiveId,
          missionId:      parsed.data.missionId,
          objectiveType:  parsed.data.objectiveType,
          objectiveName:  parsed.data.objectiveName,
          ...(parsed.data.sequenceOrder !== undefined ? { sequenceOrder: parsed.data.sequenceOrder } : {}),
          ...(parsed.data.completionData !== undefined ? { completionData: parsed.data.completionData } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof MissionRuntimeError) return reply.status(missionErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/missions/objectives/:objectiveId/complete', {
    preHandler: requireCapability(ctx, 'mission:write'),
    handler: async (req, reply) => {
      if (!ctx.objectiveTrackingService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = completeObjectiveSchema.safeParse({ objectiveId: (req.params as { objectiveId: string }).objectiveId })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.objectiveTrackingService.completeObjective(parsed.data.objectiveId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof MissionRuntimeError) return reply.status(missionErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  // ── Progression ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/missions/progress', {
    preHandler: requireCapability(ctx, 'mission:write'),
    handler: async (req, reply) => {
      if (!ctx.missionProgressionService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = progressMissionSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.missionProgressionService.progressMission(parsed.data.missionId, parsed.data.objectiveId)
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof MissionRuntimeError) return reply.status(missionErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  // ── Assignments ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/missions/assignments', {
    preHandler: requireCapability(ctx, 'mission:write'),
    handler: async (req, reply) => {
      if (!ctx.missionAssignmentRepo) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = assignMissionSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.missionAssignmentRepo.assign(
          parsed.data.missionId,
          parsed.data.assigneeId,
          parsed.data.assigneeType ?? 'player',
          parsed.data.role ?? 'participant',
        )
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof MissionRuntimeError) return reply.status(missionErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/missions/assignments/release', {
    preHandler: requireCapability(ctx, 'mission:write'),
    handler: async (req, reply) => {
      if (!ctx.missionAssignmentRepo) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = releaseMissionAssignmentSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.missionAssignmentRepo.release(parsed.data.missionId, parsed.data.assigneeId)
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof MissionRuntimeError) return reply.status(missionErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  // ── Scenarios ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/missions/scenarios', {
    preHandler: requireCapability(ctx, 'mission:write'),
    handler: async (req, reply) => {
      if (!ctx.scenarioOrchestrationService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = registerScenarioSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.scenarioOrchestrationService.registerScenario({
          scenarioId:   parsed.data.scenarioId,
          scenarioType: parsed.data.scenarioType,
          ...(parsed.data.missionId !== undefined ? { missionId: parsed.data.missionId } : {}),
          ...(parsed.data.configData !== undefined ? { configData: parsed.data.configData } : {}),
          ...(parsed.data.ownerServerId !== undefined ? { ownerServerId: parsed.data.ownerServerId } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof MissionRuntimeError) return reply.status(missionErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  // ── Dynamic Events ────────────────────────────────────────────────────────

  fastify.post('/api/v1/missions/events', {
    preHandler: requireCapability(ctx, 'mission:write'),
    handler: async (req, reply) => {
      if (!ctx.dynamicEventService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = createDynamicEventSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.dynamicEventService.createEvent({
          eventNonce:   parsed.data.eventNonce,
          eventType:    parsed.data.eventType,
          ...(parsed.data.triggerData !== undefined ? { triggerData: parsed.data.triggerData } : {}),
          ...(parsed.data.zoneId !== undefined ? { zoneId: parsed.data.zoneId } : {}),
          ...(parsed.data.ownerServerId !== undefined ? { ownerServerId: parsed.data.ownerServerId } : {}),
          ...(parsed.data.expiresAt !== undefined ? { expiresAt: new Date(parsed.data.expiresAt) } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof MissionRuntimeError) return reply.status(missionErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/missions/events', {
    preHandler: requireCapability(ctx, 'mission:read'),
    handler: async (_req, reply) => {
      if (!ctx.dynamicEventRepo) return reply.status(503).send(NOT_CONFIGURED)
      const result = await ctx.dynamicEventRepo.listActive()
      return reply.status(200).send(result)
    },
  })

  fastify.post('/api/v1/missions/events/:eventId/resolve', {
    preHandler: requireCapability(ctx, 'mission:write'),
    handler: async (req, reply) => {
      if (!ctx.dynamicEventService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = resolveEventSchema.safeParse({ eventId: (req.params as { eventId: string }).eventId })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.dynamicEventService.resolveEvent(parsed.data.eventId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof MissionRuntimeError) return reply.status(missionErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })
}
