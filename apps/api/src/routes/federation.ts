import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  registerFederationNodeSchema,
  syncRegionSchema,
  createInterclusterRouteSchema,
  claimFederationOwnershipSchema,
  transferFederationOwnershipSchema,
  startConsistencyCheckSchema,
  cleanupFederationSchema,
} from '@atc/operations'

export function federationRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Federation Nodes ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/federation/nodes/register', async (req, reply) => {
    if (!ctx.federationRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = registerFederationNodeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { regionId, address, nodeData, ...rest } = parsed.data
    const node = await ctx.federationRuntimeService.registerNode({
      ...rest,
      ...(regionId !== undefined ? { regionId } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(nodeData !== undefined ? { nodeData } : {}),
    })
    return reply.code(200).send(node)
  })

  fastify.post('/api/v1/federation/nodes/:id/deregister', async (req, reply) => {
    if (!ctx.federationRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const node = await ctx.federationRuntimeService.deregisterNode(id)
    return reply.code(200).send(node)
  })

  fastify.get('/api/v1/federation/nodes/:id', async (req, reply) => {
    if (!ctx.federationRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const node = await ctx.federationRuntimeService.getNode(id)
    if (!node) return reply.code(404).send({ error: 'Node not found' })
    return reply.code(200).send(node)
  })

  fastify.get('/api/v1/federation/nodes/active', async (req, reply) => {
    if (!ctx.federationRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { regionId } = req.query as { regionId?: string }
    const nodes = await ctx.federationRuntimeService.listActiveNodes(regionId)
    return reply.code(200).send(nodes)
  })

  // ── Region Synchronization ───────────────────────────────────────────────────

  fastify.post('/api/v1/federation/sync', async (req, reply) => {
    if (!ctx.multiRegionSyncService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = syncRegionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { syncNonce, regionData, ...rest } = parsed.data
    const region = await ctx.multiRegionSyncService.syncRegion({
      ...rest,
      ...(syncNonce !== undefined ? { syncNonce } : {}),
      ...(regionData !== undefined ? { regionData } : {}),
    })
    return reply.code(200).send(region)
  })

  fastify.get('/api/v1/federation/regions/:regionId', async (req, reply) => {
    if (!ctx.multiRegionSyncService) return reply.code(503).send({ error: 'Service unavailable' })
    const { regionId } = req.params as { regionId: string }
    const region = await ctx.multiRegionSyncService.getRegionState(regionId)
    if (!region) return reply.code(404).send({ error: 'Region not found' })
    return reply.code(200).send(region)
  })

  fastify.post('/api/v1/federation/regions/:regionId/deactivate', async (req, reply) => {
    if (!ctx.multiRegionSyncService) return reply.code(503).send({ error: 'Service unavailable' })
    const { regionId } = req.params as { regionId: string }
    await ctx.multiRegionSyncService.deactivateRegion(regionId)
    return reply.code(200).send({ ok: true })
  })

  // ── Inter-Cluster Routes ─────────────────────────────────────────────────────

  fastify.post('/api/v1/federation/routes/create', async (req, reply) => {
    if (!ctx.interclusterRoutingService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createInterclusterRouteSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { routeData, ...rest } = parsed.data
    const route = await ctx.interclusterRoutingService.createRoute({
      ...rest,
      ...(routeData !== undefined ? { routeData } : {}),
    })
    return reply.code(200).send(route)
  })

  fastify.post('/api/v1/federation/routes/:id/complete', async (req, reply) => {
    if (!ctx.interclusterRoutingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const route = await ctx.interclusterRoutingService.completeRoute(id)
    return reply.code(200).send(route)
  })

  fastify.post('/api/v1/federation/routes/:id/fail', async (req, reply) => {
    if (!ctx.interclusterRoutingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const route = await ctx.interclusterRoutingService.failRoute(id)
    return reply.code(200).send(route)
  })

  fastify.get('/api/v1/federation/routes/:id', async (req, reply) => {
    if (!ctx.interclusterRoutingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const route = await ctx.interclusterRoutingService.getRoute(id)
    if (!route) return reply.code(404).send({ error: 'Route not found' })
    return reply.code(200).send(route)
  })

  // ── Federation Ownership ─────────────────────────────────────────────────────

  fastify.post('/api/v1/federation/ownership/claim', async (req, reply) => {
    if (!ctx.federationOwnershipService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = claimFederationOwnershipSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { ownershipData, ...rest } = parsed.data
    const ownership = await ctx.federationOwnershipService.claimOwnership({
      ...rest,
      ...(ownershipData !== undefined ? { ownershipData } : {}),
    })
    return reply.code(200).send(ownership)
  })

  fastify.post('/api/v1/federation/transfer', async (req, reply) => {
    if (!ctx.federationOwnershipService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = transferFederationOwnershipSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const ownership = await ctx.federationOwnershipService.transferOwnership(
      parsed.data.entityId,
      parsed.data.newClusterId,
    )
    return reply.code(200).send(ownership)
  })

  fastify.post('/api/v1/federation/ownership/:entityId/release', async (req, reply) => {
    if (!ctx.federationOwnershipService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    await ctx.federationOwnershipService.releaseOwnership(entityId)
    return reply.code(200).send({ ok: true })
  })

  fastify.get('/api/v1/federation/ownership/:entityId', async (req, reply) => {
    if (!ctx.federationOwnershipService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const ownership = await ctx.federationOwnershipService.getOwnership(entityId)
    if (!ownership) return reply.code(404).send({ error: 'Ownership not found' })
    return reply.code(200).send(ownership)
  })

  // ── Regional Consistency ─────────────────────────────────────────────────────

  fastify.post('/api/v1/federation/consistency/start', async (req, reply) => {
    if (!ctx.regionalConsistencyService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startConsistencyCheckSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { checkData, ...rest } = parsed.data
    const check = await ctx.regionalConsistencyService.startCheck({
      ...rest,
      ...(checkData !== undefined ? { checkData } : {}),
    })
    return reply.code(200).send(check)
  })

  fastify.post('/api/v1/federation/consistency/:id/complete', async (req, reply) => {
    if (!ctx.regionalConsistencyService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const check = await ctx.regionalConsistencyService.completeCheck(id)
    return reply.code(200).send(check)
  })

  fastify.post('/api/v1/federation/consistency/:id/fail', async (req, reply) => {
    if (!ctx.regionalConsistencyService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const check = await ctx.regionalConsistencyService.failCheck(id)
    return reply.code(200).send(check)
  })

  fastify.get('/api/v1/federation/consistency/:id', async (req, reply) => {
    if (!ctx.regionalConsistencyService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const check = await ctx.regionalConsistencyService.getCheck(id)
    if (!check) return reply.code(404).send({ error: 'Consistency check not found' })
    return reply.code(200).send(check)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/federation/cleanup', async (req, reply) => {
    if (!ctx.federationRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupFederationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.federationRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
