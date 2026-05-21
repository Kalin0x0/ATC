import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  registerVesselSchema,
  updateVesselPositionSchema,
  dockVesselSchema,
  undockVesselSchema,
  registerAircraftSchema,
  createFlightSchema,
  departFlightSchema,
  landFlightSchema,
  divertFlightSchema,
  registerAirspaceZoneSchema,
  updateAirspaceStatusSchema,
} from '@atc/operations'
import { TransportRuntimeError } from '@atc/transport-runtime'

function transportErrorToStatus(err: TransportRuntimeError): number {
  const name = err.constructor.name
  if (name === 'DuplicateFlightNonceError' || name === 'DuplicateDockingNonceError') return 409
  if (name === 'AircraftAlreadyAirborneError' || name === 'VesselAlreadyDockedError') return 422
  if (name.endsWith('NotFoundError')) return 404
  return 500
}

const NOT_CONFIGURED = { error: 'Transport runtime not configured' }

export async function transportRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Vessels ───────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/transport/vessels', {
    preHandler: requireCapability(ctx, 'transport:write'),
    handler: async (req, reply) => {
      if (!ctx.maritimeRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = registerVesselSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.maritimeRuntimeService.registerVessel({
          vesselId:   parsed.data.vesselId,
          vesselName: parsed.data.vesselName,
          vesselType: parsed.data.vesselType,
          ...(parsed.data.ownedByPrincipalId !== undefined ? { ownedByPrincipalId: parsed.data.ownedByPrincipalId } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof TransportRuntimeError) return reply.status(transportErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/transport/vessels/position', {
    preHandler: requireCapability(ctx, 'transport:write'),
    handler: async (req, reply) => {
      if (!ctx.maritimeRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = updateVesselPositionSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.maritimeRuntimeService.updateVesselPosition(parsed.data.vesselId, {
          positionX: parsed.data.positionX,
          positionY: parsed.data.positionY,
          ...(parsed.data.positionZ !== undefined ? { positionZ: parsed.data.positionZ } : {}),
          ...(parsed.data.heading !== undefined ? { heading: parsed.data.heading } : {}),
          ...(parsed.data.speedKnots !== undefined ? { speedKnots: parsed.data.speedKnots } : {}),
          ...(parsed.data.zoneId !== undefined ? { zoneId: parsed.data.zoneId } : {}),
        })
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof TransportRuntimeError) return reply.status(transportErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/transport/vessels/dock', {
    preHandler: requireCapability(ctx, 'transport:write'),
    handler: async (req, reply) => {
      if (!ctx.maritimeRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = dockVesselSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.maritimeRuntimeService.dockVessel({
          dockingNonce: parsed.data.dockingNonce,
          vesselId:     parsed.data.vesselId,
          dockZoneId:   parsed.data.dockZoneId,
          ...(parsed.data.slotId !== undefined ? { slotId: parsed.data.slotId } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof TransportRuntimeError) return reply.status(transportErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/transport/vessels/undock', {
    preHandler: requireCapability(ctx, 'transport:write'),
    handler: async (req, reply) => {
      if (!ctx.maritimeRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = undockVesselSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.maritimeRuntimeService.undockVessel(parsed.data.dockingId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof TransportRuntimeError) return reply.status(transportErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/transport/vessels', {
    preHandler: requireCapability(ctx, 'transport:read'),
    handler: async (_req, reply) => {
      if (!ctx.vesselRepo) return reply.status(503).send(NOT_CONFIGURED)
      const vessels = await ctx.vesselRepo.listAll()
      return reply.status(200).send(vessels)
    },
  })

  // ── Aircraft ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/transport/aircraft', {
    preHandler: requireCapability(ctx, 'transport:write'),
    handler: async (req, reply) => {
      if (!ctx.aviationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = registerAircraftSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.aviationRuntimeService.registerAircraft({
          aircraftId:   parsed.data.aircraftId,
          aircraftName: parsed.data.aircraftName,
          aircraftType: parsed.data.aircraftType,
          ...(parsed.data.ownedByPrincipalId !== undefined ? { ownedByPrincipalId: parsed.data.ownedByPrincipalId } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof TransportRuntimeError) return reply.status(transportErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/transport/flights', {
    preHandler: requireCapability(ctx, 'transport:write'),
    handler: async (req, reply) => {
      if (!ctx.aviationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = createFlightSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.aviationRuntimeService.createFlight({
          flightNonce:       parsed.data.flightNonce,
          aircraftId:        parsed.data.aircraftId,
          originZoneId:      parsed.data.originZoneId,
          destinationZoneId: parsed.data.destinationZoneId,
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof TransportRuntimeError) return reply.status(transportErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/transport/flights/:flightId/depart', {
    preHandler: requireCapability(ctx, 'transport:write'),
    handler: async (req, reply) => {
      if (!ctx.aviationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { flightId } = req.params as { flightId: string }
      const parsed = departFlightSchema.safeParse({ flightId })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.aviationRuntimeService.departFlight(parsed.data.flightId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof TransportRuntimeError) return reply.status(transportErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/transport/flights/:flightId/land', {
    preHandler: requireCapability(ctx, 'transport:write'),
    handler: async (req, reply) => {
      if (!ctx.aviationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { flightId } = req.params as { flightId: string }
      const parsed = landFlightSchema.safeParse({ flightId })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.aviationRuntimeService.landFlight(parsed.data.flightId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof TransportRuntimeError) return reply.status(transportErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/transport/flights/:flightId/divert', {
    preHandler: requireCapability(ctx, 'transport:write'),
    handler: async (req, reply) => {
      if (!ctx.aviationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { flightId } = req.params as { flightId: string }
      const parsed = divertFlightSchema.safeParse({ flightId })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.aviationRuntimeService.divertFlight(parsed.data.flightId)
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof TransportRuntimeError) return reply.status(transportErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/transport/flights', {
    preHandler: requireCapability(ctx, 'transport:read'),
    handler: async (_req, reply) => {
      if (!ctx.flightRuntimeRepo) return reply.status(503).send(NOT_CONFIGURED)
      const flights = await ctx.flightRuntimeRepo.listActive()
      return reply.status(200).send(flights)
    },
  })

  // ── Airspace Zones ────────────────────────────────────────────────────────────

  fastify.post('/api/v1/transport/airspace', {
    preHandler: requireCapability(ctx, 'transport:write'),
    handler: async (req, reply) => {
      if (!ctx.aviationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = registerAirspaceZoneSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.aviationRuntimeService.registerAirspaceZone({
          zoneId:        parsed.data.zoneId,
          zoneName:      parsed.data.zoneName,
          zoneType:      parsed.data.zoneType,
          minAltitudeM:  parsed.data.minAltitudeM,
          maxAltitudeM:  parsed.data.maxAltitudeM,
          ...(parsed.data.ownerServerId !== undefined ? { ownerServerId: parsed.data.ownerServerId } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof TransportRuntimeError) return reply.status(transportErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.post('/api/v1/transport/airspace/:zoneId/status', {
    preHandler: requireCapability(ctx, 'transport:write'),
    handler: async (req, reply) => {
      if (!ctx.aviationRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { zoneId } = req.params as { zoneId: string }
      const parsed = updateAirspaceStatusSchema.safeParse({ zoneId, ...(req.body as object) })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        let result
        if (parsed.data.status === 'restricted') {
          result = await ctx.aviationRuntimeService.restrictAirspace(parsed.data.zoneId)
        } else {
          result = await ctx.aviationRuntimeService.openAirspace(parsed.data.zoneId)
        }
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof TransportRuntimeError) return reply.status(transportErrorToStatus(err)).send({ error: err.message })
        throw err
      }
    },
  })

  fastify.get('/api/v1/transport/airspace', {
    preHandler: requireCapability(ctx, 'transport:read'),
    handler: async (_req, reply) => {
      if (!ctx.airspaceZoneRepo) return reply.status(503).send(NOT_CONFIGURED)
      const zones = await ctx.airspaceZoneRepo.listAll()
      return reply.status(200).send(zones)
    },
  })
}
