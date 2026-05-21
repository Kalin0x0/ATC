import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  initiateRuntimeSustainmentSchema,
  initiateInfiniteRecoverySchema,
  scheduleAutonomousMaintenanceSchema,
  registerSustainmentNodeSchema,
  createRuntimeLongevitySchema,
  cleanupRuntimeSustainmentSchema,
} from '@atc/operations'

export function runtimeSustainmentRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Runtime Sustainment ──────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-sustainment', async (req, reply) => {
    if (!ctx.runtimeSustainmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateRuntimeSustainmentSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { sustainmentData, ...rest } = parsed.data
    const record = await ctx.runtimeSustainmentService.initiateSustainment({
      ...rest,
      ...(sustainmentData !== undefined ? { sustainmentData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sustainment/:id/start', async (req, reply) => {
    if (!ctx.runtimeSustainmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSustainmentService.startSustainment(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sustainment/:id/maintain', async (req, reply) => {
    if (!ctx.runtimeSustainmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSustainmentService.maintainSustainment(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sustainment/:id/complete', async (req, reply) => {
    if (!ctx.runtimeSustainmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSustainmentService.completeSustainment(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sustainment/:id/fail', async (req, reply) => {
    if (!ctx.runtimeSustainmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSustainmentService.failSustainment(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-sustainment/:id', async (req, reply) => {
    if (!ctx.runtimeSustainmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeSustainmentService.getSustainment(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Infinite Recovery ────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-sustainment/recovery', async (req, reply) => {
    if (!ctx.infiniteRecoveryCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = initiateInfiniteRecoverySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { recoveryData, ...rest } = parsed.data
    const record = await ctx.infiniteRecoveryCoordinator.initiateRecovery({
      ...rest,
      ...(recoveryData !== undefined ? { recoveryData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sustainment/recovery/:recoveryId/begin', async (req, reply) => {
    if (!ctx.infiniteRecoveryCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { recoveryId } = req.params as { recoveryId: string }
    const record = await ctx.infiniteRecoveryCoordinator.beginRecovering(recoveryId)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sustainment/recovery/:recoveryId/complete', async (req, reply) => {
    if (!ctx.infiniteRecoveryCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { recoveryId } = req.params as { recoveryId: string }
    const record = await ctx.infiniteRecoveryCoordinator.completeRecovery(recoveryId)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sustainment/recovery/:recoveryId/fail', async (req, reply) => {
    if (!ctx.infiniteRecoveryCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { recoveryId } = req.params as { recoveryId: string }
    const record = await ctx.infiniteRecoveryCoordinator.failRecovery(recoveryId)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-sustainment/recovery/:recoveryId', async (req, reply) => {
    if (!ctx.infiniteRecoveryCoordinator) return reply.code(503).send({ error: 'Service unavailable' })
    const { recoveryId } = req.params as { recoveryId: string }
    const record = await ctx.infiniteRecoveryCoordinator.getRecovery(recoveryId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Autonomous Maintenance ───────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-sustainment/maintenance', async (req, reply) => {
    if (!ctx.autonomousMaintenanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = scheduleAutonomousMaintenanceSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { maintenanceData, ...rest } = parsed.data
    const record = await ctx.autonomousMaintenanceService.scheduleMaintenance({
      ...rest,
      ...(maintenanceData !== undefined ? { maintenanceData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sustainment/maintenance/:id/run', async (req, reply) => {
    if (!ctx.autonomousMaintenanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.autonomousMaintenanceService.runMaintenance(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sustainment/maintenance/:id/complete', async (req, reply) => {
    if (!ctx.autonomousMaintenanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.autonomousMaintenanceService.completeMaintenance(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sustainment/maintenance/:id/skip', async (req, reply) => {
    if (!ctx.autonomousMaintenanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.autonomousMaintenanceService.skipMaintenance(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-sustainment/maintenance/:id', async (req, reply) => {
    if (!ctx.autonomousMaintenanceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.autonomousMaintenanceService.getMaintenance(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Distributed Sustainment Nodes ────────────────────────────────────────────

  fastify.post('/api/v1/runtime-sustainment/node', async (req, reply) => {
    if (!ctx.distributedSustainmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = registerSustainmentNodeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { nodeData, ...rest } = parsed.data
    const record = await ctx.distributedSustainmentService.registerNode({
      ...rest,
      ...(nodeData !== undefined ? { nodeData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sustainment/node/:sustainmentNodeId/degrade', async (req, reply) => {
    if (!ctx.distributedSustainmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const { sustainmentNodeId } = req.params as { sustainmentNodeId: string }
    const record = await ctx.distributedSustainmentService.degradeNode(sustainmentNodeId)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sustainment/node/:sustainmentNodeId/recover', async (req, reply) => {
    if (!ctx.distributedSustainmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const { sustainmentNodeId } = req.params as { sustainmentNodeId: string }
    const record = await ctx.distributedSustainmentService.recoverNode(sustainmentNodeId)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sustainment/node/:sustainmentNodeId/fail', async (req, reply) => {
    if (!ctx.distributedSustainmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const { sustainmentNodeId } = req.params as { sustainmentNodeId: string }
    const record = await ctx.distributedSustainmentService.failNode(sustainmentNodeId)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-sustainment/node/:sustainmentNodeId', async (req, reply) => {
    if (!ctx.distributedSustainmentService) return reply.code(503).send({ error: 'Service unavailable' })
    const { sustainmentNodeId } = req.params as { sustainmentNodeId: string }
    const record = await ctx.distributedSustainmentService.getNode(sustainmentNodeId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Runtime Longevity ────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-sustainment/longevity', async (req, reply) => {
    if (!ctx.runtimeLongevityService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createRuntimeLongevitySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { longevityData, ...rest } = parsed.data
    const record = await ctx.runtimeLongevityService.createCheckpoint({
      ...rest,
      ...(longevityData !== undefined ? { longevityData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sustainment/longevity/:id/activate', async (req, reply) => {
    if (!ctx.runtimeLongevityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeLongevityService.activateCheckpoint(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sustainment/longevity/:id/archive', async (req, reply) => {
    if (!ctx.runtimeLongevityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeLongevityService.archiveCheckpoint(id)
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/runtime-sustainment/longevity/:id/expire', async (req, reply) => {
    if (!ctx.runtimeLongevityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeLongevityService.expireCheckpoint(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/runtime-sustainment/longevity/:id', async (req, reply) => {
    if (!ctx.runtimeLongevityService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.runtimeLongevityService.getCheckpoint(id)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/runtime-sustainment/cleanup', async (req, reply) => {
    if (!ctx.sustainmentRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupRuntimeSustainmentSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.sustainmentRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
