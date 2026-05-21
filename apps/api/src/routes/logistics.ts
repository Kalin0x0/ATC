import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  createShipmentSchema,
  departShipmentSchema,
  deliverShipmentSchema,
  failShipmentSchema,
  registerSupplyRouteSchema,
  registerLogisticsFleetSchema,
  assignLogisticsFleetSchema,
  upsertSupplyChainSchema,
  disruptSupplyChainSchema,
} from '@atc/operations'
import { LogisticsRuntimeError } from '@atc/logistics-runtime'

function logisticsErrorToStatus(err: LogisticsRuntimeError): number {
  const name = err.constructor.name
  if (
    name === 'DuplicateShipmentNonceError' ||
    name === 'FleetAlreadyDeployedError'
  ) return 409
  if (
    name === 'ShipmentAlreadyInTransitError' ||
    name === 'ShipmentAlreadyDeliveredError'
  ) return 422
  if (name.endsWith('NotFoundError')) return 404
  return 500
}

const NOT_CONFIGURED = { error: 'Logistics runtime not configured' }

export async function logisticsRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Create shipment ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/logistics/shipments', {
    preHandler: requireCapability(ctx, 'logistics:write'),
    handler: async (req, reply) => {
      if (!ctx.shipmentService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = createShipmentSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.shipmentService.createShipment({
          shipmentNonce:  parsed.data.shipmentNonce,
          originId:       parsed.data.originId,
          destinationId:  parsed.data.destinationId,
          ...(parsed.data.carrierPrincipalId !== undefined ? { carrierPrincipalId: parsed.data.carrierPrincipalId } : {}),
          ...(parsed.data.cargoManifest !== undefined      ? { cargoManifest: parsed.data.cargoManifest }           : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof LogisticsRuntimeError) return reply.status(logisticsErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get shipment ──────────────────────────────────────────────────────────────

  fastify.get('/api/v1/logistics/shipments/:shipmentId', {
    preHandler: requireCapability(ctx, 'logistics:read'),
    handler: async (req, reply) => {
      if (!ctx.shipmentService) return reply.status(503).send(NOT_CONFIGURED)
      const { shipmentId } = req.params as { shipmentId: string }
      const shipment = await ctx.shipmentService.getShipment(shipmentId)
      if (!shipment) return reply.status(404).send({ error: 'ShipmentNotFound' })
      return reply.send(shipment)
    },
  })

  // ── List active shipments ─────────────────────────────────────────────────────

  fastify.get('/api/v1/logistics/shipments', {
    preHandler: requireCapability(ctx, 'logistics:read'),
    handler: async (req, reply) => {
      if (!ctx.shipmentService) return reply.status(503).send(NOT_CONFIGURED)
      const shipments = await ctx.shipmentService.listActiveShipments()
      return reply.send({ shipments })
    },
  })

  // ── Depart shipment ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/logistics/shipments/:shipmentId/depart', {
    preHandler: requireCapability(ctx, 'logistics:write'),
    handler: async (req, reply) => {
      if (!ctx.shipmentService) return reply.status(503).send(NOT_CONFIGURED)
      const { shipmentId } = req.params as { shipmentId: string }
      try {
        const result = await ctx.shipmentService.departShipment(shipmentId)
        return reply.send(result)
      } catch (err) {
        if (err instanceof LogisticsRuntimeError) return reply.status(logisticsErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Deliver shipment ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/logistics/shipments/:shipmentId/deliver', {
    preHandler: requireCapability(ctx, 'logistics:write'),
    handler: async (req, reply) => {
      if (!ctx.shipmentService) return reply.status(503).send(NOT_CONFIGURED)
      const { shipmentId } = req.params as { shipmentId: string }
      try {
        const result = await ctx.shipmentService.deliverShipment(shipmentId)
        return reply.send(result)
      } catch (err) {
        if (err instanceof LogisticsRuntimeError) return reply.status(logisticsErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Fail shipment ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/logistics/shipments/:shipmentId/fail', {
    preHandler: requireCapability(ctx, 'logistics:write'),
    handler: async (req, reply) => {
      if (!ctx.shipmentService) return reply.status(503).send(NOT_CONFIGURED)
      const { shipmentId } = req.params as { shipmentId: string }
      const parsed = failShipmentSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.shipmentService.failShipment(shipmentId, parsed.data.reason)
        return reply.send(result)
      } catch (err) {
        if (err instanceof LogisticsRuntimeError) return reply.status(logisticsErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Register supply route ─────────────────────────────────────────────────────

  fastify.post('/api/v1/logistics/routes', {
    preHandler: requireCapability(ctx, 'logistics:write'),
    handler: async (req, reply) => {
      if (!ctx.supplyRouteService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = registerSupplyRouteSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.supplyRouteService.registerRoute({
          routeId:                   parsed.data.routeId,
          routeName:                 parsed.data.routeName,
          originNodeId:              parsed.data.originNodeId,
          destinationNodeId:         parsed.data.destinationNodeId,
          routeType:                 parsed.data.routeType,
          distanceKm:                parsed.data.distanceKm,
          estimatedDurationMinutes:  parsed.data.estimatedDurationMinutes,
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof LogisticsRuntimeError) return reply.status(logisticsErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── List active routes ────────────────────────────────────────────────────────

  fastify.get('/api/v1/logistics/routes', {
    preHandler: requireCapability(ctx, 'logistics:read'),
    handler: async (req, reply) => {
      if (!ctx.supplyRouteService) return reply.status(503).send(NOT_CONFIGURED)
      const routes = await ctx.supplyRouteService.listActiveRoutes()
      return reply.send({ routes })
    },
  })

  // ── Register logistics fleet ──────────────────────────────────────────────────

  fastify.post('/api/v1/logistics/fleets', {
    preHandler: requireCapability(ctx, 'logistics:write'),
    handler: async (req, reply) => {
      if (!ctx.logisticsFleetService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = registerLogisticsFleetSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.logisticsFleetService.registerFleet({
          fleetId:          parsed.data.fleetId,
          fleetName:        parsed.data.fleetName,
          ownerPrincipalId: parsed.data.ownerPrincipalId,
          ...(parsed.data.vehicleIds !== undefined ? { vehicleIds: parsed.data.vehicleIds } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof LogisticsRuntimeError) return reply.status(logisticsErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Assign fleet to route ─────────────────────────────────────────────────────

  fastify.post('/api/v1/logistics/fleets/:fleetId/assign', {
    preHandler: requireCapability(ctx, 'logistics:write'),
    handler: async (req, reply) => {
      if (!ctx.logisticsFleetService) return reply.status(503).send(NOT_CONFIGURED)
      const { fleetId } = req.params as { fleetId: string }
      const parsed = assignLogisticsFleetSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.logisticsFleetService.assignFleet(fleetId, parsed.data.routeId)
        return reply.send(result)
      } catch (err) {
        if (err instanceof LogisticsRuntimeError) return reply.status(logisticsErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Upsert supply chain ───────────────────────────────────────────────────────

  fastify.post('/api/v1/logistics/chains', {
    preHandler: requireCapability(ctx, 'logistics:write'),
    handler: async (req, reply) => {
      if (!ctx.supplyChainService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = upsertSupplyChainSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.supplyChainService.upsertChain({
          chainId:   parsed.data.chainId,
          chainName: parsed.data.chainName,
          nodes:     parsed.data.nodes,
          edges:     parsed.data.edges,
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof LogisticsRuntimeError) return reply.status(logisticsErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Disrupt supply chain ──────────────────────────────────────────────────────

  fastify.post('/api/v1/logistics/chains/:chainId/disrupt', {
    preHandler: requireCapability(ctx, 'logistics:write'),
    handler: async (req, reply) => {
      if (!ctx.supplyChainService) return reply.status(503).send(NOT_CONFIGURED)
      const { chainId } = req.params as { chainId: string }
      try {
        const result = await ctx.supplyChainService.disruptChain(chainId)
        return reply.send(result)
      } catch (err) {
        if (err instanceof LogisticsRuntimeError) return reply.status(logisticsErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Restore supply chain ──────────────────────────────────────────────────────

  fastify.post('/api/v1/logistics/chains/:chainId/restore', {
    preHandler: requireCapability(ctx, 'logistics:write'),
    handler: async (req, reply) => {
      if (!ctx.supplyChainService) return reply.status(503).send(NOT_CONFIGURED)
      const { chainId } = req.params as { chainId: string }
      try {
        const result = await ctx.supplyChainService.restoreChain(chainId)
        return reply.send(result)
      } catch (err) {
        if (err instanceof LogisticsRuntimeError) return reply.status(logisticsErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })
}
