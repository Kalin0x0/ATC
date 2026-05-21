import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  registerEntitySchema,
  reconcileEntitySchema,
  createSceneSchema,
  persistSceneSchema,
  scheduleCleanupSchema,
} from '@atc/operations'
import {
  WorldError,
  WorldEntityNotFoundError,
  WorldEntityValidationError,
  WorldEntityAlreadySpawnedError,
  WorldEntityImmutableError,
  SceneNotFoundError,
  SceneAlreadyExistsError,
  SceneImmutableError,
  SceneLockedError,
  OwnershipConflictError,
  OwnershipNotFoundError,
  PersistentSceneNotFoundError,
  CleanupNotFoundError,
} from '@atc/world-runtime'

function worldErrorToResponse(err: WorldError): { status: number; error: string; message: string } {
  if (err instanceof WorldEntityValidationError)   return { status: 400, error: 'WorldEntityValidation',   message: err.message }
  if (err instanceof WorldEntityImmutableError)    return { status: 422, error: 'WorldEntityImmutable',    message: err.message }
  if (err instanceof SceneImmutableError)          return { status: 422, error: 'SceneImmutable',          message: err.message }
  if (err instanceof SceneLockedError)             return { status: 422, error: 'SceneLocked',             message: err.message }
  if (err instanceof WorldEntityAlreadySpawnedError) return { status: 409, error: 'WorldEntityAlreadySpawned', message: err.message }
  if (err instanceof SceneAlreadyExistsError)      return { status: 409, error: 'SceneAlreadyExists',      message: err.message }
  if (err instanceof OwnershipConflictError)       return { status: 409, error: 'OwnershipConflict',       message: err.message }
  if (err instanceof WorldEntityNotFoundError)     return { status: 404, error: 'WorldEntityNotFound',     message: err.message }
  if (err instanceof SceneNotFoundError)           return { status: 404, error: 'SceneNotFound',           message: err.message }
  if (err instanceof OwnershipNotFoundError)       return { status: 404, error: 'OwnershipNotFound',       message: err.message }
  if (err instanceof PersistentSceneNotFoundError) return { status: 404, error: 'PersistentSceneNotFound', message: err.message }
  if (err instanceof CleanupNotFoundError)         return { status: 404, error: 'CleanupNotFound',         message: err.message }
  return { status: 500, error: 'WorldError', message: err.message }
}

const NOT_CONFIGURED = { error: 'World runtime not configured' }

export async function worldRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Register entity ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/world/entities', {
    preHandler: requireCapability(ctx, 'world:entity:register'),
    handler: async (req, reply) => {
      if (!ctx.runtimeReplicationService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = registerEntitySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const entity = await ctx.runtimeReplicationService.registerEntity(parsed.data)
        return reply.status(201).send(entity)
      } catch (err) {
        if (err instanceof WorldError) return reply.status(worldErrorToResponse(err).status).send(worldErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Despawn entity ────────────────────────────────────────────────────────────

  fastify.post('/api/v1/world/entities/:entityId/despawn', {
    preHandler: requireCapability(ctx, 'world:entity:register'),
    handler: async (req, reply) => {
      if (!ctx.runtimeReplicationService) return reply.status(503).send(NOT_CONFIGURED)
      const { entityId } = req.params as { entityId: string }
      try {
        const entity = await ctx.runtimeReplicationService.despawnEntity(entityId)
        return reply.status(200).send(entity)
      } catch (err) {
        if (err instanceof WorldError) return reply.status(worldErrorToResponse(err).status).send(worldErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Reconcile entity ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/world/entities/:entityId/reconcile', {
    preHandler: requireCapability(ctx, 'world:entity:reconcile'),
    handler: async (req, reply) => {
      if (!ctx.runtimeReplicationService) return reply.status(503).send(NOT_CONFIGURED)
      const { entityId } = req.params as { entityId: string }
      const parsed = reconcileEntitySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const entity = await ctx.runtimeReplicationService.reconcileEntity(entityId, parsed.data)
        return reply.status(200).send(entity)
      } catch (err) {
        if (err instanceof WorldError) return reply.status(worldErrorToResponse(err).status).send(worldErrorToResponse(err))
        throw err
      }
    },
  })

  // ── List active scenes ────────────────────────────────────────────────────────

  fastify.get('/api/v1/world/scenes', {
    preHandler: requireCapability(ctx, 'world:scene:read'),
    handler: async (req, reply) => {
      if (!ctx.worldRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const scenes = await ctx.worldRuntimeService.listActiveScenes()
      return reply.send(scenes)
    },
  })

  // ── Create scene ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/world/scenes', {
    preHandler: requireCapability(ctx, 'world:scene:manage'),
    handler: async (req, reply) => {
      if (!ctx.sceneSynchronizationService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = createSceneSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const scene = await ctx.sceneSynchronizationService.createScene(parsed.data)
        return reply.status(201).send(scene)
      } catch (err) {
        if (err instanceof WorldError) return reply.status(worldErrorToResponse(err).status).send(worldErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Destroy scene ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/world/scenes/:sceneId/destroy', {
    preHandler: requireCapability(ctx, 'world:scene:manage'),
    handler: async (req, reply) => {
      if (!ctx.sceneSynchronizationService) return reply.status(503).send(NOT_CONFIGURED)
      const { sceneId } = req.params as { sceneId: string }
      try {
        const scene = await ctx.sceneSynchronizationService.destroyScene(sceneId)
        return reply.status(200).send(scene)
      } catch (err) {
        if (err instanceof WorldError) return reply.status(worldErrorToResponse(err).status).send(worldErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Persist scene ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/world/scenes/persist', {
    preHandler: requireCapability(ctx, 'world:scene:manage'),
    handler: async (req, reply) => {
      if (!ctx.persistentSceneService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = persistSceneSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const scene = await ctx.persistentSceneService.persistScene(parsed.data)
        return reply.status(201).send(scene)
      } catch (err) {
        if (err instanceof WorldError) return reply.status(worldErrorToResponse(err).status).send(worldErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Restore persistent scene ──────────────────────────────────────────────────

  fastify.post('/api/v1/world/scenes/:sceneId/restore', {
    preHandler: requireCapability(ctx, 'world:scene:manage'),
    handler: async (req, reply) => {
      if (!ctx.persistentSceneService) return reply.status(503).send(NOT_CONFIGURED)
      const { sceneId } = req.params as { sceneId: string }
      try {
        const scene = await ctx.persistentSceneService.restoreScene(sceneId)
        return reply.status(200).send(scene)
      } catch (err) {
        if (err instanceof WorldError) return reply.status(worldErrorToResponse(err).status).send(worldErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Schedule cleanup ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/world/cleanup', {
    preHandler: requireCapability(ctx, 'world:cleanup:manage'),
    handler: async (req, reply) => {
      if (!ctx.cleanupOrchestrationService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = scheduleCleanupSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const cleanup = await ctx.cleanupOrchestrationService.scheduleCleanup(parsed.data)
        return reply.status(201).send(cleanup)
      } catch (err) {
        if (err instanceof WorldError) return reply.status(worldErrorToResponse(err).status).send(worldErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Process pending cleanups ──────────────────────────────────────────────────

  fastify.post('/api/v1/world/cleanup/process', {
    preHandler: requireCapability(ctx, 'world:cleanup:manage'),
    handler: async (req, reply) => {
      if (!ctx.cleanupOrchestrationService) return reply.status(503).send(NOT_CONFIGURED)
      try {
        const result = await ctx.cleanupOrchestrationService.processPendingCleanups()
        return reply.status(200).send(result)
      } catch (err) {
        if (err instanceof WorldError) return reply.status(worldErrorToResponse(err).status).send(worldErrorToResponse(err))
        throw err
      }
    },
  })
}
