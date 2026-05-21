import type { FastifyInstance, FastifyReply } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  medicalIntelCharacterParamSchema,
  medicalIntelIncidentParamSchema,
  medicalIntelResponderParamSchema,
  medicalIntelTimelineQuerySchema,
  medicalIntelWindowQuerySchema,
} from '@atc/schemas'

const NOT_CONFIGURED = { error: 'Medical intelligence not configured' } as const
function badRequest(reply: FastifyReply, issues: unknown) {
  return reply.code(400).send({ error: 'Validation error', issues })
}

/**
 * Phase 29 medical-intelligence routes — read-only analytics.
 *
 * Capability:
 *   - All character-scoped reads require `dispatch.read` AND for sensitive
 *     fields (raw notes/diagnosis text) callers should also have
 *     `evidence.manage`. This route layer trusts the SDK to honour those
 *     boundaries; sensitive redaction is the SDK's job (deferred to Phase 30).
 */
export async function medicalIntelligenceRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  fastify.get('/api/v1/medical-intel/character/:id/history', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.medicalIntelSdk) return reply.code(503).send(NOT_CONFIGURED)
    const params = medicalIntelCharacterParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    return reply.send(await ctx.medicalIntelSdk.getHistory(params.data.id))
  })

  fastify.get('/api/v1/medical-intel/character/:id/timeline', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.medicalIntelSdk) return reply.code(503).send(NOT_CONFIGURED)
    const params = medicalIntelCharacterParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    const q = medicalIntelTimelineQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.issues)
    const page = await ctx.medicalIntelSdk.getTimeline(params.data.id, {
      limit: q.data.limit,
      ...(q.data.cursor !== undefined ? { cursor: q.data.cursor } : {}),
      ...(q.data.since !== undefined ? { since: q.data.since } : {}),
      ...(q.data.until !== undefined ? { until: q.data.until } : {}),
    })
    return reply.send(page)
  })

  fastify.get('/api/v1/medical-intel/character/:id/risk', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.medicalIntelSdk) return reply.code(503).send(NOT_CONFIGURED)
    const params = medicalIntelCharacterParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    const q = medicalIntelWindowQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.issues)
    return reply.send(await ctx.medicalIntelSdk.getRisk(params.data.id, q.data.windowDays))
  })

  fastify.get('/api/v1/medical-intel/character/:id/analytics', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.medicalIntelSdk) return reply.code(503).send(NOT_CONFIGURED)
    const params = medicalIntelCharacterParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    const q = medicalIntelWindowQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.issues)
    return reply.send(await ctx.medicalIntelSdk.getAnalytics(params.data.id, q.data.windowDays))
  })

  fastify.get('/api/v1/medical-intel/responders/:id/history', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.medicalIntelSdk) return reply.code(503).send(NOT_CONFIGURED)
    const params = medicalIntelResponderParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    const q = medicalIntelWindowQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.issues)
    return reply.send(await ctx.medicalIntelSdk.getResponderHistory(params.data.id, q.data.windowDays))
  })

  fastify.get('/api/v1/medical-intel/incidents/:id/correlation', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.medicalIntelSdk) return reply.code(503).send(NOT_CONFIGURED)
    const params = medicalIntelIncidentParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    return reply.send(await ctx.medicalIntelSdk.getIncidentCorrelation(params.data.id))
  })
}
