import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  registerMetaRuntimeSchema,
  startHealingSchema,
  startRepairSchema,
  upsertAllocationSchema,
  upsertCoordinationSchema,
  cleanupMetaRuntimeSchema,
} from '@atc/operations'

export function metaRuntimeRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Meta Runtime ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/meta-runtime/register', async (req, reply) => {
    if (!ctx.metaRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = registerMetaRuntimeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { metaData, ...rest } = parsed.data
    const meta = await ctx.metaRuntimeService.registerMeta({
      ...rest,
      ...(metaData !== undefined ? { metaData } : {}),
    })
    return reply.code(200).send(meta)
  })

  fastify.post('/api/v1/meta-runtime/:id/pause', async (req, reply) => {
    if (!ctx.metaRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const meta = await ctx.metaRuntimeService.pauseMeta(id)
    return reply.code(200).send(meta)
  })

  fastify.post('/api/v1/meta-runtime/:id/terminate', async (req, reply) => {
    if (!ctx.metaRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const meta = await ctx.metaRuntimeService.terminateMeta(id)
    return reply.code(200).send(meta)
  })

  fastify.get('/api/v1/meta-runtime/:id', async (req, reply) => {
    if (!ctx.metaRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const meta = await ctx.metaRuntimeService.getMeta(id)
    if (!meta) return reply.code(404).send({ error: 'Meta runtime not found' })
    return reply.code(200).send(meta)
  })

  fastify.get('/api/v1/meta-runtime/active', async (req, reply) => {
    if (!ctx.metaRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { ownerServerId } = req.query as { ownerServerId?: string }
    const metas = await ctx.metaRuntimeService.listActiveMeta(ownerServerId)
    return reply.code(200).send(metas)
  })

  // ── Autonomous Healing ───────────────────────────────────────────────────────

  fastify.post('/api/v1/meta-runtime/healing/start', async (req, reply) => {
    if (!ctx.autonomousHealingService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startHealingSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { healingData, ...rest } = parsed.data
    const healing = await ctx.autonomousHealingService.startHealing({
      ...rest,
      ...(healingData !== undefined ? { healingData } : {}),
    })
    return reply.code(200).send(healing)
  })

  fastify.post('/api/v1/meta-runtime/healing/:id/complete', async (req, reply) => {
    if (!ctx.autonomousHealingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const healing = await ctx.autonomousHealingService.completeHealing(id)
    return reply.code(200).send(healing)
  })

  fastify.post('/api/v1/meta-runtime/healing/:id/fail', async (req, reply) => {
    if (!ctx.autonomousHealingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const healing = await ctx.autonomousHealingService.failHealing(id)
    return reply.code(200).send(healing)
  })

  fastify.get('/api/v1/meta-runtime/healing/:id', async (req, reply) => {
    if (!ctx.autonomousHealingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const healing = await ctx.autonomousHealingService.getHealing(id)
    if (!healing) return reply.code(404).send({ error: 'Healing operation not found' })
    return reply.code(200).send(healing)
  })

  // ── Distributed Repair ───────────────────────────────────────────────────────

  fastify.post('/api/v1/meta-runtime/repair/start', async (req, reply) => {
    if (!ctx.distributedRepairService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startRepairSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { repairData, ...rest } = parsed.data
    const repair = await ctx.distributedRepairService.startRepair({
      ...rest,
      ...(repairData !== undefined ? { repairData } : {}),
    })
    return reply.code(200).send(repair)
  })

  fastify.post('/api/v1/meta-runtime/repair/:id/complete', async (req, reply) => {
    if (!ctx.distributedRepairService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const repair = await ctx.distributedRepairService.completeRepair(id)
    return reply.code(200).send(repair)
  })

  fastify.post('/api/v1/meta-runtime/repair/:id/fail', async (req, reply) => {
    if (!ctx.distributedRepairService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const repair = await ctx.distributedRepairService.failRepair(id)
    return reply.code(200).send(repair)
  })

  fastify.get('/api/v1/meta-runtime/repair/:id', async (req, reply) => {
    if (!ctx.distributedRepairService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const repair = await ctx.distributedRepairService.getRepair(id)
    if (!repair) return reply.code(404).send({ error: 'Repair operation not found' })
    return reply.code(200).send(repair)
  })

  // ── Meta Allocation ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/meta-runtime/allocations', async (req, reply) => {
    if (!ctx.metaAllocationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertAllocationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { allocationData, ...rest } = parsed.data
    const allocation = await ctx.metaAllocationService.allocate({
      ...rest,
      ...(allocationData !== undefined ? { allocationData } : {}),
    })
    return reply.code(200).send(allocation)
  })

  fastify.delete('/api/v1/meta-runtime/allocations/:entityId', async (req, reply) => {
    if (!ctx.metaAllocationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    await ctx.metaAllocationService.release(entityId)
    return reply.code(200).send({ released: true })
  })

  fastify.get('/api/v1/meta-runtime/allocations/:entityId', async (req, reply) => {
    if (!ctx.metaAllocationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const allocation = await ctx.metaAllocationService.getAllocation(entityId)
    if (!allocation) return reply.code(404).send({ error: 'Allocation not found' })
    return reply.code(200).send(allocation)
  })

  // ── Runtime Coordination ─────────────────────────────────────────────────────

  fastify.post('/api/v1/meta-runtime/coordination', async (req, reply) => {
    if (!ctx.runtimeCoordinationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertCoordinationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { coordinationData, ...rest } = parsed.data
    const coordination = await ctx.runtimeCoordinationService.upsertCoordination({
      ...rest,
      ...(coordinationData !== undefined ? { coordinationData } : {}),
    })
    return reply.code(200).send(coordination)
  })

  fastify.post('/api/v1/meta-runtime/coordination/:nodeId/fail', async (req, reply) => {
    if (!ctx.runtimeCoordinationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { nodeId } = req.params as { nodeId: string }
    await ctx.runtimeCoordinationService.failNode(nodeId)
    return reply.code(200).send({ failed: true })
  })

  fastify.get('/api/v1/meta-runtime/coordination/:nodeId', async (req, reply) => {
    if (!ctx.runtimeCoordinationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { nodeId } = req.params as { nodeId: string }
    const coordination = await ctx.runtimeCoordinationService.getCoordination(nodeId)
    if (!coordination) return reply.code(404).send({ error: 'Coordination not found' })
    return reply.code(200).send(coordination)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/meta-runtime/cleanup', async (req, reply) => {
    if (!ctx.selfHealingRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupMetaRuntimeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.selfHealingRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
