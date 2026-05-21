import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  registerInfrastructureSchema,
  updateInfrastructureHealthSchema,
  reportInfrastructureFailureSchema,
  resolveInfrastructureFailureSchema,
  updateTrafficSignalSchema,
  updateEnvironmentSchema,
  recordResourceConsumptionSchema,
  reportUtilityOutageSchema,
  restoreUtilityGridSchema,
} from '@atc/operations'
import { CityRuntimeError } from '@atc/city-runtime'

function cityErrorToStatus(err: CityRuntimeError): number {
  const name = err.constructor.name
  if (
    name === 'UtilityGridAlreadyDownError' ||
    name === 'UtilityGridAlreadyRestoredError' ||
    name === 'InfrastructureAlreadyRecoveredError' ||
    name === 'DuplicateOutageError'
  ) return 409
  if (name.endsWith('NotFoundError')) return 404
  return 500
}

const NOT_CONFIGURED = { error: 'City runtime not configured' }

export async function cityRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Register / upsert infrastructure node ────────────────────────────────────

  fastify.post('/api/v1/city/infrastructure', {
    preHandler: requireCapability(ctx, 'city:write'),
    handler: async (req, reply) => {
      if (!ctx.cityInfrastructureService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = registerInfrastructureSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.cityInfrastructureService.updateInfrastructureStatus(
          parsed.data.nodeId,
          parsed.data.nodeName,
          parsed.data.infrastructureType,
          'operational',
          100,
        )
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof CityRuntimeError) return reply.status(cityErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get infrastructure node ───────────────────────────────────────────────────

  fastify.get('/api/v1/city/infrastructure/:nodeId', {
    preHandler: requireCapability(ctx, 'city:read'),
    handler: async (req, reply) => {
      if (!ctx.cityInfrastructureService) return reply.status(503).send(NOT_CONFIGURED)
      const { nodeId } = req.params as { nodeId: string }
      const infra = await ctx.cityInfrastructureService.getInfrastructure(nodeId)
      if (!infra) return reply.status(404).send({ error: 'InfrastructureNotFound' })
      return reply.send(infra)
    },
  })

  // ── Update infrastructure health ──────────────────────────────────────────────

  fastify.patch('/api/v1/city/infrastructure/:nodeId/health', {
    preHandler: requireCapability(ctx, 'city:write'),
    handler: async (req, reply) => {
      if (!ctx.cityInfrastructureRepo) return reply.status(503).send(NOT_CONFIGURED)
      const { nodeId } = req.params as { nodeId: string }
      const parsed = updateInfrastructureHealthSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      if (parsed.data.status !== undefined) {
        await ctx.cityInfrastructureRepo.updateStatus(nodeId, parsed.data.status)
      }
      const infra = await ctx.cityInfrastructureRepo.findByNodeId(nodeId)
      if (!infra) return reply.status(404).send({ error: 'InfrastructureNotFound' })
      return reply.send(infra)
    },
  })

  // ── List degraded infrastructure ──────────────────────────────────────────────

  fastify.get('/api/v1/city/infrastructure/degraded', {
    preHandler: requireCapability(ctx, 'city:read'),
    handler: async (req, reply) => {
      if (!ctx.cityInfrastructureService) return reply.status(503).send(NOT_CONFIGURED)
      const degraded = await ctx.cityInfrastructureService.listDegraded()
      return reply.send({ infrastructure: degraded })
    },
  })

  // ── Report infrastructure failure ─────────────────────────────────────────────

  fastify.post('/api/v1/city/failures', {
    preHandler: requireCapability(ctx, 'city:write'),
    handler: async (req, reply) => {
      if (!ctx.cityInfrastructureService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = reportInfrastructureFailureSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.cityInfrastructureService.reportFailure({
          nodeId:       parsed.data.nodeId,
          failureType:  parsed.data.failureType,
          severity:     parsed.data.severity,
          failureNonce: parsed.data.failureNonce,
          ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof CityRuntimeError) return reply.status(cityErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Resolve infrastructure failure ────────────────────────────────────────────

  fastify.post('/api/v1/city/failures/:failureId/resolve', {
    preHandler: requireCapability(ctx, 'city:write'),
    handler: async (req, reply) => {
      if (!ctx.infrastructureRecoveryService) return reply.status(503).send(NOT_CONFIGURED)
      const { failureId } = req.params as { failureId: string }
      const parsed = resolveInfrastructureFailureSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.infrastructureRecoveryService.recoverInfrastructure(
          failureId,
          parsed.data.resolvedBy,
        )
        return reply.send(result)
      } catch (err) {
        if (err instanceof CityRuntimeError) return reply.status(cityErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── List active failures ──────────────────────────────────────────────────────

  fastify.get('/api/v1/city/failures/active', {
    preHandler: requireCapability(ctx, 'city:read'),
    handler: async (req, reply) => {
      if (!ctx.infrastructureRecoveryService) return reply.status(503).send(NOT_CONFIGURED)
      const failures = await ctx.infrastructureRecoveryService.listActiveFailures()
      return reply.send({ failures })
    },
  })

  // ── Update traffic signal ─────────────────────────────────────────────────────

  fastify.post('/api/v1/city/traffic-signals', {
    preHandler: requireCapability(ctx, 'city:write'),
    handler: async (req, reply) => {
      if (!ctx.trafficSignalService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = updateTrafficSignalSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.trafficSignalService.updateSignal(
          parsed.data.signalId,
          parsed.data.signalName,
          parsed.data.state ?? 'green',
          parsed.data.changedBy,
        )
        return reply.send(result)
      } catch (err) {
        if (err instanceof CityRuntimeError) return reply.status(cityErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get traffic signal ────────────────────────────────────────────────────────

  fastify.get('/api/v1/city/traffic-signals/:signalId', {
    preHandler: requireCapability(ctx, 'city:read'),
    handler: async (req, reply) => {
      if (!ctx.trafficSignalService) return reply.status(503).send(NOT_CONFIGURED)
      const { signalId } = req.params as { signalId: string }
      const signal = await ctx.trafficSignalService.getSignal(signalId)
      if (!signal) return reply.status(404).send({ error: 'SignalNotFound' })
      return reply.send(signal)
    },
  })

  // ── Update environment ────────────────────────────────────────────────────────

  fastify.post('/api/v1/city/environment', {
    preHandler: requireCapability(ctx, 'city:write'),
    handler: async (req, reply) => {
      if (!ctx.environmentRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = updateEnvironmentSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.environmentRuntimeService.updateEnvironment(parsed.data.regionId, {
          ...(parsed.data.weather !== undefined ? { weather: parsed.data.weather } : {}),
          ...(parsed.data.timeOfDay !== undefined ? { timeOfDay: parsed.data.timeOfDay } : {}),
          ...(parsed.data.temperature !== undefined ? { temperature: parsed.data.temperature } : {}),
          ...(parsed.data.windSpeed !== undefined ? { windSpeed: parsed.data.windSpeed } : {}),
          ...(parsed.data.visibility !== undefined ? { visibility: parsed.data.visibility } : {}),
          ...(parsed.data.isEmergencyWeather !== undefined ? { isEmergencyWeather: parsed.data.isEmergencyWeather } : {}),
          ...(parsed.data.activeEventId !== undefined ? { activeEventId: parsed.data.activeEventId } : {}),
        })
        return reply.send(result)
      } catch (err) {
        if (err instanceof CityRuntimeError) return reply.status(cityErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get environment ───────────────────────────────────────────────────────────

  fastify.get('/api/v1/city/environment/:regionId', {
    preHandler: requireCapability(ctx, 'city:read'),
    handler: async (req, reply) => {
      if (!ctx.environmentRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { regionId } = req.params as { regionId: string }
      const env = await ctx.environmentRuntimeService.getEnvironment(regionId)
      if (!env) return reply.status(404).send({ error: 'EnvironmentNotFound' })
      return reply.send(env)
    },
  })

  // ── Record resource consumption ───────────────────────────────────────────────

  fastify.post('/api/v1/city/consumption', {
    preHandler: requireCapability(ctx, 'city:write'),
    handler: async (req, reply) => {
      if (!ctx.resourceConsumptionService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = recordResourceConsumptionSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.resourceConsumptionService.recordConsumption(
          parsed.data.gridId,
          parsed.data.resourceType,
          parsed.data.amount,
          parsed.data.consumerId,
          parsed.data.periodLabel,
        )
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof CityRuntimeError) return reply.status(cityErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Report utility outage ─────────────────────────────────────────────────────

  fastify.post('/api/v1/city/utility-grids/outage', {
    preHandler: requireCapability(ctx, 'city:write'),
    handler: async (req, reply) => {
      if (!ctx.utilityGridService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = reportUtilityOutageSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.utilityGridService.reportOutage(
          parsed.data.gridId,
          parsed.data.gridName,
          parsed.data.utilityType,
          parsed.data.outageNonce,
          parsed.data.reason,
          parsed.data.affectedZones,
        )
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof CityRuntimeError) return reply.status(cityErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Restore utility grid ──────────────────────────────────────────────────────

  fastify.post('/api/v1/city/utility-grids/:gridId/restore', {
    preHandler: requireCapability(ctx, 'city:write'),
    handler: async (req, reply) => {
      if (!ctx.utilityGridService) return reply.status(503).send(NOT_CONFIGURED)
      const { gridId } = req.params as { gridId: string }
      const parsed = restoreUtilityGridSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.utilityGridService.restoreGrid(gridId, parsed.data.restoredByPrincipalId)
        return reply.send(result)
      } catch (err) {
        if (err instanceof CityRuntimeError) return reply.status(cityErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get utility grid ──────────────────────────────────────────────────────────

  fastify.get('/api/v1/city/utility-grids/:gridId', {
    preHandler: requireCapability(ctx, 'city:read'),
    handler: async (req, reply) => {
      if (!ctx.utilityGridService) return reply.status(503).send(NOT_CONFIGURED)
      const { gridId } = req.params as { gridId: string }
      const grid = await ctx.utilityGridService.getGrid(gridId)
      if (!grid) return reply.status(404).send({ error: 'GridNotFound' })
      return reply.send(grid)
    },
  })
}
