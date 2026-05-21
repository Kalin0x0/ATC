import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  registerNodeSchema,
  startDeploymentSchema,
  startScalingSchema,
  allocateEntitySchema,
  upsertLifecycleSchema,
  cleanupClusterSchema,
} from '@atc/operations'

export function clusterRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Cluster Nodes ────────────────────────────────────────────────────────────

  fastify.post('/api/v1/cluster/nodes/register', async (req, reply) => {
    if (!ctx.clusterRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = registerNodeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { address, nodeData, ...rest } = parsed.data
    const node = await ctx.clusterRuntimeService.registerNode({
      ...rest,
      ...(address !== undefined ? { address } : {}),
      ...(nodeData !== undefined ? { nodeData } : {}),
    })
    return reply.code(200).send(node)
  })

  fastify.post('/api/v1/cluster/nodes/:id/deregister', async (req, reply) => {
    if (!ctx.clusterRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const node = await ctx.clusterRuntimeService.deregisterNode(id)
    return reply.code(200).send(node)
  })

  fastify.get('/api/v1/cluster/nodes/:id', async (req, reply) => {
    if (!ctx.clusterRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const node = await ctx.clusterRuntimeService.getNode(id)
    if (!node) return reply.code(404).send({ error: 'Node not found' })
    return reply.code(200).send(node)
  })

  fastify.get('/api/v1/cluster/nodes/active', async (req, reply) => {
    if (!ctx.clusterRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { ownerServerId } = req.query as { ownerServerId?: string }
    const nodes = await ctx.clusterRuntimeService.listActiveNodes(ownerServerId)
    return reply.code(200).send(nodes)
  })

  // ── Deployments ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/cluster/deployments/start', async (req, reply) => {
    if (!ctx.deploymentOrchestrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startDeploymentSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { deploymentData, ...rest } = parsed.data
    const deployment = await ctx.deploymentOrchestrationService.startDeployment({
      ...rest,
      ...(deploymentData !== undefined ? { deploymentData } : {}),
    })
    return reply.code(200).send(deployment)
  })

  fastify.post('/api/v1/cluster/deployments/:id/complete', async (req, reply) => {
    if (!ctx.deploymentOrchestrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const deployment = await ctx.deploymentOrchestrationService.completeDeployment(id)
    return reply.code(200).send(deployment)
  })

  fastify.post('/api/v1/cluster/deployments/:id/fail', async (req, reply) => {
    if (!ctx.deploymentOrchestrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const deployment = await ctx.deploymentOrchestrationService.failDeployment(id)
    return reply.code(200).send(deployment)
  })

  fastify.get('/api/v1/cluster/deployments/:id', async (req, reply) => {
    if (!ctx.deploymentOrchestrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const deployment = await ctx.deploymentOrchestrationService.getDeployment(id)
    if (!deployment) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(deployment)
  })

  // ── Scaling ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/cluster/scaling/start', async (req, reply) => {
    if (!ctx.runtimeScalingService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startScalingSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { scalingData, ...rest } = parsed.data
    const scaling = await ctx.runtimeScalingService.startScaling({
      ...rest,
      ...(scalingData !== undefined ? { scalingData } : {}),
    })
    return reply.code(200).send(scaling)
  })

  fastify.post('/api/v1/cluster/scaling/:id/complete', async (req, reply) => {
    if (!ctx.runtimeScalingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const scaling = await ctx.runtimeScalingService.completeScaling(id)
    return reply.code(200).send(scaling)
  })

  // ── Node Lifecycle ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/cluster/lifecycle/upsert', async (req, reply) => {
    if (!ctx.nodeLifecycleService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertLifecycleSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { status, lifecycleData, ...rest } = parsed.data
    const lifecycle = await ctx.nodeLifecycleService.upsertLifecycle({
      ...rest,
      ...(status !== undefined ? { status } : {}),
      ...(lifecycleData !== undefined ? { lifecycleData } : {}),
    })
    return reply.code(200).send(lifecycle)
  })

  fastify.get('/api/v1/cluster/lifecycle/:nodeId', async (req, reply) => {
    if (!ctx.nodeLifecycleService) return reply.code(503).send({ error: 'Service unavailable' })
    const { nodeId } = req.params as { nodeId: string }
    const lifecycle = await ctx.nodeLifecycleService.getLifecycle(nodeId)
    if (!lifecycle) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(lifecycle)
  })

  // ── Allocation ───────────────────────────────────────────────────────────────

  fastify.post('/api/v1/cluster/allocation/allocate', async (req, reply) => {
    if (!ctx.clusterAllocationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = allocateEntitySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { allocationData, ...rest } = parsed.data
    const allocation = await ctx.clusterAllocationService.allocate({
      ...rest,
      ...(allocationData !== undefined ? { allocationData } : {}),
    })
    return reply.code(200).send(allocation)
  })

  fastify.get('/api/v1/cluster/allocation/:entityId', async (req, reply) => {
    if (!ctx.clusterAllocationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const allocation = await ctx.clusterAllocationService.getAllocation(entityId)
    if (!allocation) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(allocation)
  })

  fastify.delete('/api/v1/cluster/allocation/:entityId', async (req, reply) => {
    if (!ctx.clusterAllocationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    await ctx.clusterAllocationService.deallocate(entityId)
    return reply.code(204).send()
  })

  // ── Maintenance ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/cluster/cleanup', async (req, reply) => {
    if (!ctx.distributedDeploymentRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupClusterSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.distributedDeploymentRecoveryService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
