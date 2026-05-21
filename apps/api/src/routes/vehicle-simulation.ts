import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  syncFuelSchema,
  consumeFuelSchema,
  refuelSchema,
  syncDamageSchema,
  applyVehicleDamageSchema,
  registerVehicleRegistrationSchema,
  startPursuitSchema,
  endPursuitSchema,
  recordViolationSchema,
  vehicleHeartbeatSchema,
} from '@atc/operations'
import {
  VehicleSimError,
} from '@atc/vehicle-simulation'

function vehicleSimErrorToStatus(err: VehicleSimError): number {
  const name = err.constructor.name
  if (name === 'VehicleRegistrationAlreadyActiveError' || name === 'PursuitAlreadyActiveError') return 409
  if (name === 'FuelTankEmptyError' || name === 'VehicleRegistrationExpiredError' || name === 'PursuitEndedError') return 422
  if (name.endsWith('NotFoundError')) return 404
  return 500
}

const NOT_CONFIGURED = { error: 'Vehicle simulation not configured' }

export async function vehicleSimulationRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Sync fuel ─────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/vehicles/runtime/fuel/sync', {
    preHandler: requireCapability(ctx, 'vehicle-simulation:fuel:write'),
    handler: async (req, reply) => {
      if (!ctx.fuelRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = syncFuelSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.fuelRuntimeService.syncFuel(parsed.data.vehicleRuntimeId, parsed.data.currentFuel)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof VehicleSimError) return reply.status(vehicleSimErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Consume fuel ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/vehicles/runtime/fuel/consume', {
    preHandler: requireCapability(ctx, 'vehicle-simulation:fuel:write'),
    handler: async (req, reply) => {
      if (!ctx.fuelRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = consumeFuelSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.fuelRuntimeService.consumeFuel(parsed.data.vehicleRuntimeId, parsed.data.amount)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof VehicleSimError) return reply.status(vehicleSimErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Refuel ────────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/vehicles/runtime/fuel/refuel', {
    preHandler: requireCapability(ctx, 'vehicle-simulation:fuel:write'),
    handler: async (req, reply) => {
      if (!ctx.fuelRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = refuelSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.fuelRuntimeService.refuel(parsed.data.vehicleRuntimeId, parsed.data.amount, 100)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof VehicleSimError) return reply.status(vehicleSimErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get fuel ──────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/vehicles/runtime/fuel/:vehicleRuntimeId', {
    preHandler: requireCapability(ctx, 'vehicle-simulation:fuel:read'),
    handler: async (req, reply) => {
      if (!ctx.fuelRepo) return reply.status(503).send(NOT_CONFIGURED)
      const { vehicleRuntimeId } = req.params as { vehicleRuntimeId: string }
      const record = await ctx.fuelRepo.findByRuntimeId(vehicleRuntimeId)
      if (!record) return reply.status(404).send({ error: 'FuelRecordNotFound' })
      return reply.send(record)
    },
  })

  // ── Sync damage ───────────────────────────────────────────────────────────────

  fastify.post('/api/v1/vehicles/runtime/damage/sync', {
    preHandler: requireCapability(ctx, 'vehicle-simulation:damage:write'),
    handler: async (req, reply) => {
      if (!ctx.damageRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = syncDamageSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const { vehicleRuntimeId, ...damageState } = parsed.data
        const result = await ctx.damageRuntimeService.syncDamage(vehicleRuntimeId, damageState)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof VehicleSimError) return reply.status(vehicleSimErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Apply vehicle damage ───────────────────────────────────────────────────────

  fastify.post('/api/v1/vehicles/runtime/damage/apply', {
    preHandler: requireCapability(ctx, 'vehicle-simulation:damage:write'),
    handler: async (req, reply) => {
      if (!ctx.damageRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = applyVehicleDamageSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const { vehicleRuntimeId, ...damageParams } = parsed.data
        const result = await ctx.damageRuntimeService.applyDamage(vehicleRuntimeId, damageParams)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof VehicleSimError) return reply.status(vehicleSimErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get damage ────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/vehicles/runtime/damage/:vehicleRuntimeId', {
    preHandler: requireCapability(ctx, 'vehicle-simulation:damage:read'),
    handler: async (req, reply) => {
      if (!ctx.vehicleDamageRepo) return reply.status(503).send(NOT_CONFIGURED)
      const { vehicleRuntimeId } = req.params as { vehicleRuntimeId: string }
      const record = await ctx.vehicleDamageRepo.findByRuntimeId(vehicleRuntimeId)
      if (!record) return reply.status(404).send({ error: 'DamageRecordNotFound' })
      return reply.send(record)
    },
  })

  // ── Register vehicle ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/vehicles/runtime/registration/register', {
    preHandler: requireCapability(ctx, 'vehicle-simulation:registration:write'),
    handler: async (req, reply) => {
      if (!ctx.registrationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = registerVehicleRegistrationSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.registrationRuntimeService.register({
          vehicleId: parsed.data.vehicleId,
          ownerPrincipalId: parsed.data.ownerPrincipalId,
          plate: parsed.data.plate,
          expiresAt: new Date(parsed.data.expiresAt),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof VehicleSimError) return reply.status(vehicleSimErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Validate registration ─────────────────────────────────────────────────────

  fastify.get('/api/v1/vehicles/runtime/registration/:vehicleId/validate', {
    preHandler: requireCapability(ctx, 'vehicle-simulation:registration:read'),
    handler: async (req, reply) => {
      if (!ctx.registrationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { vehicleId } = req.params as { vehicleId: string }
      try {
        const result = await ctx.registrationRuntimeService.validateRegistration(vehicleId)
        return reply.send(result)
      } catch (err) {
        if (err instanceof VehicleSimError) return reply.status(vehicleSimErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Start pursuit ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/vehicles/runtime/pursuits', {
    preHandler: requireCapability(ctx, 'vehicle-simulation:pursuit:write'),
    handler: async (req, reply) => {
      if (!ctx.pursuitRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = startPursuitSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.pursuitRuntimeService.startPursuit(parsed.data)
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof VehicleSimError) return reply.status(vehicleSimErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── End pursuit ───────────────────────────────────────────────────────────────

  fastify.patch('/api/v1/vehicles/runtime/pursuits/:pursuitId/end', {
    preHandler: requireCapability(ctx, 'vehicle-simulation:pursuit:write'),
    handler: async (req, reply) => {
      if (!ctx.pursuitRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = endPursuitSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const { pursuitId, toStatus, ...opts } = parsed.data
        const result = await ctx.pursuitRuntimeService.endPursuit(pursuitId, toStatus, opts)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof VehicleSimError) return reply.status(vehicleSimErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Record traffic violation ──────────────────────────────────────────────────

  fastify.post('/api/v1/vehicles/runtime/violations', {
    preHandler: requireCapability(ctx, 'vehicle-simulation:violation:write'),
    handler: async (req, reply) => {
      if (!ctx.trafficControlService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = recordViolationSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.trafficControlService.recordViolation(parsed.data)
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof VehicleSimError) return reply.status(vehicleSimErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Vehicle heartbeat ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/vehicles/runtime/heartbeat', {
    preHandler: requireCapability(ctx, 'vehicle-simulation:heartbeat:write'),
    handler: async (req, reply) => {
      if (!ctx.vehicleSimService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = vehicleHeartbeatSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const { vehicleRuntimeId, distanceDelta, topSpeedSnapshot, collisionIncrement } = parsed.data
        await ctx.vehicleSimService.heartbeat(vehicleRuntimeId, {
          currentFuel: 0,
          distanceDelta: distanceDelta ?? 0,
          topSpeed: topSpeedSnapshot ?? 0,
          collisionDelta: collisionIncrement ? 1 : 0,
          engineMinutes: 0,
        })
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof VehicleSimError) return reply.status(vehicleSimErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get vehicle sim state ─────────────────────────────────────────────────────

  fastify.get('/api/v1/vehicles/runtime/:vehicleRuntimeId/state', {
    preHandler: requireCapability(ctx, 'vehicle-simulation:state:read'),
    handler: async (req, reply) => {
      if (!ctx.vehicleSimService) return reply.status(503).send(NOT_CONFIGURED)
      const { vehicleRuntimeId } = req.params as { vehicleRuntimeId: string }
      const state = await ctx.vehicleSimService.getVehicleSimState(vehicleRuntimeId)
      return reply.send(state)
    },
  })
}
