import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  createGlobalSnapshotSchema,
  startCompressionSchema,
  upsertPersistenceStateSchema,
  startLongtermRecoverySchema,
  createArchiveSchema,
  cleanupPersistenceSchema,
} from '@atc/operations'

export function persistenceRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Snapshots ────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/persistence/snapshots/create', async (req, reply) => {
    if (!ctx.globalPersistenceService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createGlobalSnapshotSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { entityId, snapshotData, ...rest } = parsed.data
    const snapshot = await ctx.globalPersistenceService.createSnapshot({
      ...rest,
      ...(entityId !== undefined ? { entityId } : {}),
      ...(snapshotData !== undefined ? { snapshotData } : {}),
    })
    return reply.code(200).send(snapshot)
  })

  fastify.post('/api/v1/persistence/snapshots/:id/complete', async (req, reply) => {
    if (!ctx.globalPersistenceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const snapshot = await ctx.globalPersistenceService.completeSnapshot(id)
    return reply.code(200).send(snapshot)
  })

  fastify.get('/api/v1/persistence/snapshots/:id', async (req, reply) => {
    if (!ctx.globalPersistenceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const snapshot = await ctx.globalPersistenceService.getSnapshot(id)
    if (!snapshot) return reply.code(404).send({ error: 'Snapshot not found' })
    return reply.code(200).send(snapshot)
  })

  fastify.get('/api/v1/persistence/snapshots/active', async (req, reply) => {
    if (!ctx.globalPersistenceService) return reply.code(503).send({ error: 'Service unavailable' })
    const { ownerServerId } = req.query as { ownerServerId?: string }
    const snapshots = await ctx.globalPersistenceService.listActiveSnapshots(ownerServerId)
    return reply.code(200).send(snapshots)
  })

  // ── Compression ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/persistence/compression/start', async (req, reply) => {
    if (!ctx.snapshotCompressionService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startCompressionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { compressionData, ...rest } = parsed.data
    const compression = await ctx.snapshotCompressionService.startCompression({
      ...rest,
      ...(compressionData !== undefined ? { compressionData } : {}),
    })
    return reply.code(200).send(compression)
  })

  fastify.post('/api/v1/persistence/compression/:id/complete', async (req, reply) => {
    if (!ctx.snapshotCompressionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const compression = await ctx.snapshotCompressionService.completeCompression(id)
    return reply.code(200).send(compression)
  })

  fastify.get('/api/v1/persistence/compression/:id', async (req, reply) => {
    if (!ctx.snapshotCompressionService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const compression = await ctx.snapshotCompressionService.getCompression(id)
    if (!compression) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(compression)
  })

  // ── Persistence State ────────────────────────────────────────────────────────

  fastify.post('/api/v1/persistence/state/upsert', async (req, reply) => {
    if (!ctx.distributedSnapshotService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertPersistenceStateSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { status, persistenceData, ...rest } = parsed.data
    const state = await ctx.distributedSnapshotService.upsertState({
      ...rest,
      ...(status !== undefined ? { status } : {}),
      ...(persistenceData !== undefined ? { persistenceData } : {}),
    })
    return reply.code(200).send(state)
  })

  fastify.get('/api/v1/persistence/state/:entityId', async (req, reply) => {
    if (!ctx.distributedSnapshotService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const state = await ctx.distributedSnapshotService.getState(entityId)
    if (!state) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(state)
  })

  // ── Long-Term Recovery ───────────────────────────────────────────────────────

  fastify.post('/api/v1/persistence/recovery/start', async (req, reply) => {
    if (!ctx.longTermRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startLongtermRecoverySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { entityId, recoveryData, ...rest } = parsed.data
    const recovery = await ctx.longTermRecoveryService.startRecovery({
      ...rest,
      ...(entityId !== undefined ? { entityId } : {}),
      ...(recoveryData !== undefined ? { recoveryData } : {}),
    })
    return reply.code(200).send(recovery)
  })

  fastify.post('/api/v1/persistence/recovery/:id/complete', async (req, reply) => {
    if (!ctx.longTermRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const recovery = await ctx.longTermRecoveryService.completeRecovery(id)
    return reply.code(200).send(recovery)
  })

  fastify.get('/api/v1/persistence/recovery/:id', async (req, reply) => {
    if (!ctx.longTermRecoveryService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const recovery = await ctx.longTermRecoveryService.getRecovery(id)
    if (!recovery) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(recovery)
  })

  // ── Archival ─────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/persistence/archive/create', async (req, reply) => {
    if (!ctx.runtimeArchivalService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = createArchiveSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { compressionType, archiveData, ...rest } = parsed.data
    const archive = await ctx.runtimeArchivalService.createArchive({
      ...rest,
      ...(compressionType !== undefined ? { compressionType } : {}),
      ...(archiveData !== undefined ? { archiveData } : {}),
    })
    return reply.code(200).send(archive)
  })

  fastify.get('/api/v1/persistence/archive/:id', async (req, reply) => {
    if (!ctx.runtimeArchivalService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const archive = await ctx.runtimeArchivalService.getArchive(id)
    if (!archive) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(archive)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/persistence/cleanup', async (req, reply) => {
    if (!ctx.persistenceConsistencyService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupPersistenceSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const result = await ctx.persistenceConsistencyService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send(result)
  })
}
