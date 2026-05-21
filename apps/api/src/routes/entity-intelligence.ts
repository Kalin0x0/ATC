import type { FastifyInstance, FastifyReply } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  entityIdParamSchema,
  correlationTimelineQuerySchema,
  correlationAssociatesQuerySchema,
  correlationHistoricalGraphQuerySchema,
} from '@atc/schemas'

const NOT_CONFIGURED = { error: 'Entity intelligence not configured' } as const
function badRequest(reply: FastifyReply, issues: unknown) {
  return reply.code(400).send({ error: 'Validation error', issues })
}

/**
 * Phase 28 entity-intelligence routes — read-only correlation/timeline/risk.
 *
 * All routes:
 * - require `dispatch.read` capability
 * - return paginated, bounded results (max limit 100, max depth 4)
 * - reject malformed cursors / over-large windows at the schema layer
 */
export async function entityIntelligenceRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  fastify.get('/api/v1/entities/:id/timeline', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.entityIntelSdk) return reply.code(503).send(NOT_CONFIGURED)
    const params = entityIdParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    const q = correlationTimelineQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.issues)
    const page = await ctx.entityIntelSdk.getTimeline(params.data.id, {
      limit: q.data.limit,
      ...(q.data.cursor !== undefined ? { cursor: q.data.cursor } : {}),
      ...(q.data.since !== undefined ? { since: q.data.since } : {}),
      ...(q.data.until !== undefined ? { until: q.data.until } : {}),
    })
    return reply.send(page)
  })

  fastify.get('/api/v1/entities/:id/associates', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.entityIntelSdk) return reply.code(503).send(NOT_CONFIGURED)
    const params = entityIdParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    const q = correlationAssociatesQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.issues)
    const associates = await ctx.entityIntelSdk.getAssociates(params.data.id, q.data.limit)
    return reply.send({ entityId: params.data.id, associates })
  })

  fastify.get('/api/v1/entities/:id/risk', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.entityIntelSdk) return reply.code(503).send(NOT_CONFIGURED)
    const params = entityIdParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    const risk = await ctx.entityIntelSdk.getRisk(params.data.id)
    return reply.send(risk)
  })

  fastify.get('/api/v1/entities/:id/clusters', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.entityIntelSdk) return reply.code(503).send(NOT_CONFIGURED)
    const params = entityIdParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    const cluster = await ctx.entityIntelSdk.getClusters(params.data.id)
    return reply.send(cluster)
  })

  fastify.get('/api/v1/entities/:id/history/graph', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.entityIntelSdk) return reply.code(503).send(NOT_CONFIGURED)
    const params = entityIdParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    const q = correlationHistoricalGraphQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.issues)
    const graph = await ctx.entityIntelSdk.getHistoricalGraph(params.data.id, q.data.asOf, q.data.depth)
    return reply.send(graph)
  })
}
