import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  upsertSpatialNodeSchema,
  claimOwnershipSchema,
  transferOwnershipSchema,
  updateStreamingStateSchema,
  createSnapshotSchema,
  upsertInterestRegionSchema,
  cleanupReplicationSchema,
} from '@atc/operations'

export function replicationRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Spatial Nodes ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/replication/nodes/upsert', async (req, reply) => {
    if (!ctx.spatialPartitionService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertSpatialNodeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const node = await ctx.spatialPartitionService.registerNode(parsed.data)
    return reply.code(200).send(node)
  })

  fastify.get('/api/v1/replication/nodes/active', async (_req, reply) => {
    if (!ctx.spatialPartitionService) return reply.code(503).send({ error: 'Service unavailable' })
    const nodes = await ctx.spatialPartitionService.listActiveNodes()
    return reply.code(200).send(nodes)
  })

  fastify.post('/api/v1/replication/nodes/cleanup', async (req, reply) => {
    if (!ctx.spatialPartitionService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupReplicationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const count = await ctx.spatialPartitionService.cleanupStaleNodes(parsed.data.thresholdMs)
    return reply.code(200).send({ count })
  })

  // ── Spatial Ownership ───────────────────────────────────────────────────────

  fastify.post('/api/v1/replication/ownership/claim', async (req, reply) => {
    if (!ctx.spatialOwnershipService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = claimOwnershipSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const ownership = await ctx.spatialOwnershipService.claimOwnership(parsed.data)
    return reply.code(200).send(ownership)
  })

  fastify.post('/api/v1/replication/ownership/transfer', async (req, reply) => {
    if (!ctx.spatialOwnershipService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = transferOwnershipSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const ownership = await ctx.spatialOwnershipService.transferOwnership(
      parsed.data.entityId,
      parsed.data.fromServerId,
      parsed.data.toServerId,
    )
    return reply.code(200).send(ownership)
  })

  fastify.get('/api/v1/replication/ownership/:entityId', async (req, reply) => {
    if (!ctx.spatialOwnershipService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const ownership = await ctx.spatialOwnershipService.getOwnership(entityId)
    if (!ownership) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(ownership)
  })

  fastify.delete('/api/v1/replication/ownership/:entityId', async (req, reply) => {
    if (!ctx.spatialOwnershipService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    await ctx.spatialOwnershipService.releaseOwnership(entityId)
    return reply.code(204).send()
  })

  fastify.post('/api/v1/replication/ownership/cleanup', async (req, reply) => {
    if (!ctx.spatialOwnershipService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupReplicationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const count = await ctx.spatialOwnershipService.cleanupStaleOwnership(parsed.data.thresholdMs)
    return reply.code(200).send({ count })
  })

  // ── Streaming Runtime ───────────────────────────────────────────────────────

  fastify.post('/api/v1/replication/streaming/upsert', async (req, reply) => {
    if (!ctx.runtimeStreamingService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = updateStreamingStateSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const runtime = await ctx.runtimeStreamingService.updateStreamingState(parsed.data)
    return reply.code(200).send(runtime)
  })

  fastify.get('/api/v1/replication/streaming/:entityId', async (req, reply) => {
    if (!ctx.runtimeStreamingService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const runtime = await ctx.runtimeStreamingService.getStreamingState(entityId)
    if (!runtime) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(runtime)
  })

  fastify.post('/api/v1/replication/streaming/cleanup', async (req, reply) => {
    if (!ctx.runtimeStreamingService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupReplicationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const count = await ctx.runtimeStreamingService.cleanupStaleStreaming(parsed.data.thresholdMs)
    return reply.code(200).send({ count })
  })

  // ── Runtime Snapshots ───────────────────────────────────────────────────────

  fastify.post('/api/v1/replication/snapshots/create', async (req, reply) => {
    if (!ctx.replicationRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createSnapshotSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const snapshot = await ctx.replicationRuntimeService.createSnapshot(parsed.data)
    return reply.code(201).send(snapshot)
  })

  fastify.post('/api/v1/replication/snapshots/:snapshotId/replay', async (req, reply) => {
    if (!ctx.replicationRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { snapshotId } = req.params as { snapshotId: string }
    const snapshot = await ctx.replicationRuntimeService.replaySnapshot(snapshotId)
    return reply.code(200).send(snapshot)
  })

  fastify.get('/api/v1/replication/snapshots/entity/:entityId', async (req, reply) => {
    if (!ctx.replicationRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const snapshots = await ctx.replicationRuntimeService.listSnapshotsByEntity(entityId)
    return reply.code(200).send(snapshots)
  })

  // ── Interest Regions ────────────────────────────────────────────────────────

  fastify.post('/api/v1/replication/interest-regions/upsert', async (req, reply) => {
    if (!ctx.interestManagementService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertInterestRegionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const region = await ctx.interestManagementService.registerRegion(parsed.data)
    return reply.code(200).send(region)
  })

  fastify.get('/api/v1/replication/interest-regions/active', async (_req, reply) => {
    if (!ctx.interestManagementService) return reply.code(503).send({ error: 'Service unavailable' })
    const regions = await ctx.interestManagementService.listRegions()
    return reply.code(200).send(regions)
  })

  fastify.delete('/api/v1/replication/interest-regions/:regionId', async (req, reply) => {
    if (!ctx.interestManagementService) return reply.code(503).send({ error: 'Service unavailable' })
    const { regionId } = req.params as { regionId: string }
    await ctx.interestManagementService.deactivateRegion(regionId)
    return reply.code(204).send()
  })
}
