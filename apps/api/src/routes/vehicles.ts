import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  registerVehicleSchema,
  spawnVehicleSchema,
  retrieveVehicleSchema,
  storeVehicleSchema,
  impoundVehicleSchema,
  releaseVehicleSchema,
  syncRuntimeSchema,
  assignFleetSchema,
  unassignFleetSchema,
} from '@atc/operations'
import {
  VehicleError,
  VehicleValidationError,
  VehicleNotFoundError,
  VehicleImmutableError,
  VehicleAlreadySpawnedError,
  VehicleAlreadyStoredError,
  VehicleAlreadyImpoundedError,
  GarageCapacityError,
  GarageVehicleNotFoundError,
  ImpoundNotFoundError,
  EvidenceHoldError,
  FleetAssignmentConflictError,
  FleetAssignmentNotFoundError,
} from '@atc/vehicle-runtime'

function vehicleErrorToResponse(err: VehicleError): { status: number; error: string; message: string } {
  if (err instanceof VehicleValidationError)       return { status: 400, error: 'VehicleValidation',       message: err.message }
  if (err instanceof VehicleImmutableError)        return { status: 422, error: 'VehicleImmutable',        message: err.message }
  if (err instanceof VehicleAlreadySpawnedError)   return { status: 409, error: 'VehicleAlreadySpawned',   message: err.message }
  if (err instanceof VehicleAlreadyStoredError)    return { status: 409, error: 'VehicleAlreadyStored',    message: err.message }
  if (err instanceof VehicleAlreadyImpoundedError) return { status: 409, error: 'VehicleAlreadyImpounded', message: err.message }
  if (err instanceof GarageCapacityError)          return { status: 409, error: 'GarageCapacity',          message: err.message }
  if (err instanceof EvidenceHoldError)            return { status: 403, error: 'EvidenceHold',            message: err.message }
  if (err instanceof FleetAssignmentConflictError) return { status: 409, error: 'FleetAssignmentConflict', message: err.message }
  if (err instanceof VehicleNotFoundError)         return { status: 404, error: 'VehicleNotFound',         message: err.message }
  if (err instanceof GarageVehicleNotFoundError)   return { status: 404, error: 'GarageVehicleNotFound',   message: err.message }
  if (err instanceof ImpoundNotFoundError)         return { status: 404, error: 'ImpoundNotFound',         message: err.message }
  if (err instanceof FleetAssignmentNotFoundError) return { status: 404, error: 'FleetAssignmentNotFound', message: err.message }
  return { status: 500, error: 'VehicleError', message: err.message }
}

const NOT_CONFIGURED = { error: 'Vehicle runtime not configured' }

export async function vehicleRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Register vehicle ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/vehicles', {
    preHandler: requireCapability(ctx, 'vehicle:register'),
    handler: async (req, reply) => {
      if (!ctx.vehicleRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = registerVehicleSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const vehicle = await ctx.vehicleRuntimeService.registerVehicle(parsed.data)
        return reply.status(201).send(vehicle)
      } catch (err) {
        if (err instanceof VehicleError) {
          const r = vehicleErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Get vehicle ───────────────────────────────────────────────────────────────

  fastify.get('/api/v1/vehicles/:vehicleId', {
    preHandler: requireCapability(ctx, 'vehicle:read'),
    handler: async (req, reply) => {
      if (!ctx.vehicleRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { vehicleId } = req.params as { vehicleId: string }
      const result = await ctx.vehicleRuntimeService.findById(vehicleId)
      if (!result) return reply.status(404).send({ error: 'VehicleNotFound', message: `Vehicle ${vehicleId} not found` })
      return reply.send(result)
    },
  })

  // ── Spawn vehicle ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/vehicles/:vehicleId/spawn', {
    preHandler: requireCapability(ctx, 'vehicle:spawn'),
    handler: async (req, reply) => {
      if (!ctx.vehicleRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { vehicleId } = req.params as { vehicleId: string }
      const parsed = spawnVehicleSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.vehicleRuntimeService.spawn(vehicleId, parsed.data)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof VehicleError) {
          const r = vehicleErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Retrieve from garage ──────────────────────────────────────────────────────

  fastify.post('/api/v1/vehicles/:vehicleId/retrieve', {
    preHandler: requireCapability(ctx, 'vehicle:retrieve'),
    handler: async (req, reply) => {
      if (!ctx.vehicleRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { vehicleId } = req.params as { vehicleId: string }
      const parsed = retrieveVehicleSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.vehicleRuntimeService.retrieve(vehicleId, parsed.data)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof VehicleError) {
          const r = vehicleErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Store vehicle ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/vehicles/:vehicleId/store', {
    preHandler: requireCapability(ctx, 'vehicle:store'),
    handler: async (req, reply) => {
      if (!ctx.vehicleRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { vehicleId } = req.params as { vehicleId: string }
      const parsed = storeVehicleSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const vehicle = await ctx.vehicleRuntimeService.store(vehicleId, parsed.data)
        return reply.status(200).send(vehicle)
      } catch (err) {
        if (err instanceof VehicleError) {
          const r = vehicleErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Impound vehicle ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/vehicles/:vehicleId/impound', {
    preHandler: requireCapability(ctx, 'vehicle:impound'),
    handler: async (req, reply) => {
      if (!ctx.vehicleRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { vehicleId } = req.params as { vehicleId: string }
      const parsed = impoundVehicleSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const vehicle = await ctx.vehicleRuntimeService.impound(vehicleId, parsed.data)
        return reply.status(200).send(vehicle)
      } catch (err) {
        if (err instanceof VehicleError) {
          const r = vehicleErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Release from impound ──────────────────────────────────────────────────────

  fastify.post('/api/v1/vehicles/:vehicleId/release', {
    preHandler: requireCapability(ctx, 'vehicle:impound'),
    handler: async (req, reply) => {
      if (!ctx.vehicleRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { vehicleId } = req.params as { vehicleId: string }
      const parsed = releaseVehicleSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const vehicle = await ctx.vehicleRuntimeService.release(vehicleId, parsed.data)
        return reply.status(200).send(vehicle)
      } catch (err) {
        if (err instanceof VehicleError) {
          const r = vehicleErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Sync runtime ──────────────────────────────────────────────────────────────

  fastify.patch('/api/v1/vehicles/:vehicleId/runtime', {
    preHandler: requireCapability(ctx, 'vehicle:sync'),
    handler: async (req, reply) => {
      if (!ctx.vehicleRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { vehicleId } = req.params as { vehicleId: string }
      const parsed = syncRuntimeSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.vehicleRuntimeService.syncRuntime(vehicleId, parsed.data)
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof VehicleError) {
          const r = vehicleErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  // ── Garage routes ─────────────────────────────────────────────────────────────

  fastify.get('/api/v1/garages', {
    preHandler: requireCapability(ctx, 'vehicle:read'),
    handler: async (_req, reply) => {
      if (!ctx.garageService) return reply.status(503).send(NOT_CONFIGURED)
      const garages = await ctx.garageService.listGarages()
      return reply.send(garages)
    },
  })

  fastify.get('/api/v1/garages/:garageId/vehicles', {
    preHandler: requireCapability(ctx, 'vehicle:read'),
    handler: async (req, reply) => {
      if (!ctx.garageService) return reply.status(503).send(NOT_CONFIGURED)
      const { garageId } = req.params as { garageId: string }
      const vehicles = await ctx.garageService.listVehicles(garageId)
      return reply.send(vehicles)
    },
  })

  // ── Impound queries ───────────────────────────────────────────────────────────

  fastify.get('/api/v1/vehicles/:vehicleId/impounds', {
    preHandler: requireCapability(ctx, 'vehicle:impound'),
    handler: async (req, reply) => {
      if (!ctx.impoundService) return reply.status(503).send(NOT_CONFIGURED)
      const { vehicleId } = req.params as { vehicleId: string }
      const records = await ctx.impoundService.listByVehicle(vehicleId)
      return reply.send(records)
    },
  })

  // ── Fleet routes ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/fleet/assign', {
    preHandler: requireCapability(ctx, 'vehicle:fleet'),
    handler: async (req, reply) => {
      if (!ctx.fleetService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = assignFleetSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const assignment = await ctx.fleetService.assign(parsed.data)
        return reply.status(201).send(assignment)
      } catch (err) {
        if (err instanceof VehicleError) {
          const r = vehicleErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  fastify.delete('/api/v1/fleet/assignments/:assignmentId', {
    preHandler: requireCapability(ctx, 'vehicle:fleet'),
    handler: async (req, reply) => {
      if (!ctx.fleetService) return reply.status(503).send(NOT_CONFIGURED)
      const { assignmentId } = req.params as { assignmentId: string }
      const parsed = unassignFleetSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const assignment = await ctx.fleetService.unassign(assignmentId, parsed.data.unassignedByPrincipalId)
        return reply.status(200).send(assignment)
      } catch (err) {
        if (err instanceof VehicleError) {
          const r = vehicleErrorToResponse(err)
          return reply.status(r.status).send(r)
        }
        throw err
      }
    },
  })

  fastify.get('/api/v1/fleet/organizations/:organizationId', {
    preHandler: requireCapability(ctx, 'vehicle:fleet'),
    handler: async (req, reply) => {
      if (!ctx.fleetService) return reply.status(503).send(NOT_CONFIGURED)
      const { organizationId } = req.params as { organizationId: string }
      const assignments = await ctx.fleetService.listActiveForOrganization(organizationId)
      return reply.send(assignments)
    },
  })
}
