import type { FastifyInstance, FastifyReply } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  entityIdParamSchema,
  entitySearchQuerySchema,
  entityRelationshipsQuerySchema,
  entityRelatedQuerySchema,
  entityHistoryQuerySchema,
} from '@atc/schemas'
import { InvalidTraversalDepthError } from '@atc/entity-graph'
import type { AtcRelationshipKind } from '@atc/shared-types'

const NOT_CONFIGURED = { error: 'Entity graph not configured' } as const

function badRequest(reply: FastifyReply, issues: unknown) {
  return reply.code(400).send({ error: 'Validation error', issues })
}

/**
 * Entity-graph routes — strictly read-only intelligence/indexing surface.
 *
 * INVARIANTS:
 * - All routes use GET only.
 * - Capability-guarded against `dispatch.read` (default) — callers needing
 *   restricted entity visibility should additionally check `law.read`.
 * - Hard limits (max 100, depth max 4) enforced at schema layer.
 */
export async function entityRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Global search ───────────────────────────────────────────────────────

  fastify.get('/api/v1/entities/search', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.entityGraphSdk) return reply.code(503).send(NOT_CONFIGURED)
    const parsed = entitySearchQuerySchema.safeParse(req.query)
    if (!parsed.success) return badRequest(reply, parsed.error.issues)
    const { q, types, limit, cursor } = parsed.data
    const result = await ctx.entityGraphSdk.search({
      query: q,
      ...(types !== undefined ? { types } : {}),
      limit,
      ...(cursor !== undefined ? { cursor } : {}),
    })
    return reply.send(result)
  })

  // ── Entity by id ────────────────────────────────────────────────────────

  fastify.get('/api/v1/entities/:id', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.entityGraphSdk) return reply.code(503).send(NOT_CONFIGURED)
    const params = entityIdParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    const entity = await ctx.entityGraphSdk.getEntity(params.data.id)
    if (!entity) return reply.code(404).send({ error: 'EntityNotFound', message: `Entity not found: ${params.data.id}` })
    // Visibility gate: restricted entities require law.read
    if (entity.visibility === 'restricted') {
      const principal = req.principal
      const hasLawRead = principal?.capabilities?.some((c) => (c as string) === 'law.read') ?? !ctx.authEngine
      if (!hasLawRead) return reply.code(403).send({ error: 'Forbidden', code: 'VISIBILITY_RESTRICTED' })
    }
    return reply.send(entity)
  })

  // ── Relationships ───────────────────────────────────────────────────────

  fastify.get('/api/v1/entities/:id/relationships', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.entityGraphSdk) return reply.code(503).send(NOT_CONFIGURED)
    const params = entityIdParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    const q = entityRelationshipsQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.issues)
    const args: Parameters<typeof ctx.entityGraphSdk.getRelationships>[0] = {
      entityId: params.data.id,
      direction: q.data.direction,
      includeEnded: q.data.includeEnded,
      limit: q.data.limit,
    }
    if (q.data.relationship !== undefined) args.relationship = q.data.relationship as AtcRelationshipKind
    if (q.data.cursor !== undefined) args.cursor = q.data.cursor
    const page = await ctx.entityGraphSdk.getRelationships(args)
    return reply.send(page)
  })

  // ── History ─────────────────────────────────────────────────────────────

  fastify.get('/api/v1/entities/:id/history', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.entityGraphSdk) return reply.code(503).send(NOT_CONFIGURED)
    const params = entityIdParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    const q = entityHistoryQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.issues)
    const page = await ctx.entityGraphSdk.getHistory(params.data.id, q.data.limit, q.data.cursor ?? null)
    return reply.send(page)
  })

  // ── Related (graph traversal) ───────────────────────────────────────────

  fastify.get('/api/v1/entities/:id/related', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.entityGraphSdk) return reply.code(503).send(NOT_CONFIGURED)
    const params = entityIdParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    const q = entityRelatedQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.issues)
    try {
      const args: Parameters<typeof ctx.entityGraphSdk.getRelated>[0] = {
        entityId: params.data.id,
        depth: q.data.depth,
        includeEnded: q.data.includeEnded,
      }
      if (q.data.relationships !== undefined) {
        args.relationships = q.data.relationships as AtcRelationshipKind[]
      }
      const graph = await ctx.entityGraphSdk.getRelated(args)
      return reply.send(graph)
    } catch (err) {
      if (err instanceof InvalidTraversalDepthError) {
        return reply.code(400).send({ error: 'InvalidTraversalDepth', message: err.message })
      }
      throw err
    }
  })
}
