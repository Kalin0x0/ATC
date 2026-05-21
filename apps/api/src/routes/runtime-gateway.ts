import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  createRuntimeGatewaySchema,
  syncAccessMeshSchema,
  syncGatewayRoutingSchema,
  createRuntimeExposureSchema,
  createSurfaceProtectionSchema,
  cleanupRuntimeGatewaySchema,
} from '@atc/operations'

export function runtimeGatewayRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Runtime Gateway ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-gateway', async (req, reply) => {
    if (!ctx.runtimeGatewayService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createRuntimeGatewaySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { gatewayData, ...rest } = parsed.data
    const record = await ctx.runtimeGatewayService.createGateway({
      ...rest,
      ...(gatewayData !== undefined ? { gatewayData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-gateway/:id/activate', async (req, reply) => {
    if (!ctx.runtimeGatewayService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeGatewayService.activateGateway(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-gateway/:id/suspend', async (req, reply) => {
    if (!ctx.runtimeGatewayService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeGatewayService.suspendGateway(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-gateway/:id/expire', async (req, reply) => {
    if (!ctx.runtimeGatewayService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeGatewayService.expireGateway(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-gateway/:id/fail', async (req, reply) => {
    if (!ctx.runtimeGatewayService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeGatewayService.failGateway(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-gateway/:id', async (req, reply) => {
    if (!ctx.runtimeGatewayService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeGatewayService.getGateway(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Access Mesh ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-gateway/mesh', async (req, reply) => {
    if (!ctx.deterministicAccessMeshService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = syncAccessMeshSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { meshData, ...rest } = parsed.data
    const record = await ctx.deterministicAccessMeshService.syncMesh({
      ...rest,
      ...(meshData !== undefined ? { meshData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-gateway/mesh/:meshId/degrade', async (req, reply) => {
    if (!ctx.deterministicAccessMeshService) return reply.code(503).send({ error: 'Service unavailable' })
    const { meshId } = req.params as { meshId: string }
    const record = await ctx.deterministicAccessMeshService.degradeMesh(meshId)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-gateway/mesh/:meshId/recover', async (req, reply) => {
    if (!ctx.deterministicAccessMeshService) return reply.code(503).send({ error: 'Service unavailable' })
    const { meshId } = req.params as { meshId: string }
    const record = await ctx.deterministicAccessMeshService.recoverMesh(meshId)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-gateway/mesh/:meshId', async (req, reply) => {
    if (!ctx.deterministicAccessMeshService) return reply.code(503).send({ error: 'Service unavailable' })
    const { meshId } = req.params as { meshId: string }
    const record = await ctx.deterministicAccessMeshService.getMesh(meshId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Gateway Routing ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-gateway/routing', async (req, reply) => {
    if (!ctx.distributedApiRoutingService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = syncGatewayRoutingSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { routingData, ...rest } = parsed.data
    const record = await ctx.distributedApiRoutingService.configureRouting({
      ...rest,
      ...(routingData !== undefined ? { routingData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-gateway/routing/:routingId/activate', async (req, reply) => {
    if (!ctx.distributedApiRoutingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { routingId } = req.params as { routingId: string }
    const record = await ctx.distributedApiRoutingService.activateRouting(routingId)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-gateway/routing/:routingId/suspend', async (req, reply) => {
    if (!ctx.distributedApiRoutingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { routingId } = req.params as { routingId: string }
    const record = await ctx.distributedApiRoutingService.suspendRouting(routingId)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-gateway/routing/:routingId', async (req, reply) => {
    if (!ctx.distributedApiRoutingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { routingId } = req.params as { routingId: string }
    const record = await ctx.distributedApiRoutingService.getRouting(routingId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Runtime Exposure ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-gateway/exposure', async (req, reply) => {
    if (!ctx.runtimeExposureCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createRuntimeExposureSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { exposureData, ...rest } = parsed.data
    const record = await ctx.runtimeExposureCoordinator.exposeRuntime({
      ...rest,
      ...(exposureData !== undefined ? { exposureData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-gateway/exposure/:id/begin', async (req, reply) => {
    if (!ctx.runtimeExposureCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeExposureCoordinator.beginExposing(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-gateway/exposure/:id/complete', async (req, reply) => {
    if (!ctx.runtimeExposureCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeExposureCoordinator.completeExposure(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-gateway/exposure/:id/retract', async (req, reply) => {
    if (!ctx.runtimeExposureCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeExposureCoordinator.retractExposure(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-gateway/exposure/:id', async (req, reply) => {
    if (!ctx.runtimeExposureCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeExposureCoordinator.getExposure(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Surface Protection ───────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-gateway/protection', async (req, reply) => {
    if (!ctx.runtimeSurfaceProtectionService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createSurfaceProtectionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { protectionData, ...rest } = parsed.data
    const record = await ctx.runtimeSurfaceProtectionService.createProtection({
      ...rest,
      ...(protectionData !== undefined ? { protectionData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-gateway/protection/:id/activate', async (req, reply) => {
    if (!ctx.runtimeSurfaceProtectionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSurfaceProtectionService.activateProtection(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-gateway/protection/:id/breach', async (req, reply) => {
    if (!ctx.runtimeSurfaceProtectionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSurfaceProtectionService.breachProtection(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-gateway/protection/:id/expire', async (req, reply) => {
    if (!ctx.runtimeSurfaceProtectionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSurfaceProtectionService.expireProtection(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-gateway/protection/:id', async (req, reply) => {
    if (!ctx.runtimeSurfaceProtectionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSurfaceProtectionService.getProtection(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-gateway/cleanup', async (req, reply) => {
    if (!ctx.gatewayRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupRuntimeGatewaySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.gatewayRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
