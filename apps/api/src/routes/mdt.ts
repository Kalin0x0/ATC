import type { FastifyInstance, FastifyReply } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  mdtCharacterParamSchema,
  mdtIncidentParamSchema,
  mdtSearchQuerySchema,
} from '@atc/schemas'

const NOT_CONFIGURED = { error: 'MDT system not configured' } as const

function badRequest(reply: FastifyReply, issues: unknown) {
  return reply.code(400).send({ error: 'Validation error', issues })
}

/**
 * MDT routes — strictly read-only operational intelligence surface.
 *
 * INVARIANTS:
 * - All routes use GET only.
 * - All routes are capability-guarded against `dispatch.read` or `law.read`.
 * - No route triggers any write or event-emitting code path.
 */
export async function mdtRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Character profile ─────────────────────────────────────────────────────

  fastify.get('/api/v1/mdt/characters/:id', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.mdtService) return reply.code(503).send(NOT_CONFIGURED)
    const params = mdtCharacterParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    const profile = await ctx.mdtService.getCharacterProfile(params.data.id)
    return reply.send(profile)
  })

  // ── Incident summary ──────────────────────────────────────────────────────

  fastify.get('/api/v1/mdt/incidents/:id', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.mdtService) return reply.code(503).send(NOT_CONFIGURED)
    const params = mdtIncidentParamSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error.issues)
    // Support either getIncidentSummary (Phase 25 service) or the legacy
    // MdtService which lacks it. Fail-soft.
    const svc = ctx.mdtService as unknown as {
      getIncidentSummary?: (id: string) => Promise<unknown>
    }
    if (typeof svc.getIncidentSummary !== 'function') {
      return reply.code(503).send(NOT_CONFIGURED)
    }
    const summary = await svc.getIncidentSummary(params.data.id)
    if (summary === null) {
      return reply.code(404).send({ error: 'IncidentNotFound', message: `Incident not found: ${params.data.id}` })
    }
    return reply.send(summary)
  })

  // ── Search: characters ────────────────────────────────────────────────────

  fastify.get('/api/v1/mdt/search/characters', {
    preHandler: requireCapability(ctx, 'law.read'),
  }, async (req, reply) => {
    if (!ctx.mdtService) return reply.code(503).send(NOT_CONFIGURED)
    const q = mdtSearchQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.issues)
    const svc = ctx.mdtService as unknown as {
      searchCharacters?: (query: string, opts: { limit: number; cursor?: string }) => Promise<unknown>
    }
    if (typeof svc.searchCharacters !== 'function') return reply.code(503).send(NOT_CONFIGURED)
    const result = await svc.searchCharacters(q.data.q, {
      limit: q.data.limit,
      ...(q.data.cursor !== undefined ? { cursor: q.data.cursor } : {}),
    })
    return reply.send(result)
  })

  // ── Search: incidents ─────────────────────────────────────────────────────

  fastify.get('/api/v1/mdt/search/incidents', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.mdtService) return reply.code(503).send(NOT_CONFIGURED)
    const q = mdtSearchQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.issues)
    const svc = ctx.mdtService as unknown as {
      searchIncidents?: (query: string, opts: { limit: number; cursor?: string }) => Promise<unknown>
    }
    if (typeof svc.searchIncidents !== 'function') return reply.code(503).send(NOT_CONFIGURED)
    const result = await svc.searchIncidents(q.data.q, {
      limit: q.data.limit,
      ...(q.data.cursor !== undefined ? { cursor: q.data.cursor } : {}),
    })
    return reply.send(result)
  })

  // ── Search: BOLOs ─────────────────────────────────────────────────────────

  fastify.get('/api/v1/mdt/search/bolos', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.mdtService) return reply.code(503).send(NOT_CONFIGURED)
    const q = mdtSearchQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.issues)
    const svc = ctx.mdtService as unknown as {
      searchBolos?: (query: string, opts: { limit: number; cursor?: string }) => Promise<unknown>
    }
    if (typeof svc.searchBolos !== 'function') return reply.code(503).send(NOT_CONFIGURED)
    const result = await svc.searchBolos(q.data.q, {
      limit: q.data.limit,
      ...(q.data.cursor !== undefined ? { cursor: q.data.cursor } : {}),
    })
    return reply.send(result)
  })

  // ── Search: vehicles ──────────────────────────────────────────────────────

  fastify.get('/api/v1/mdt/search/vehicles', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.mdtService) return reply.code(503).send(NOT_CONFIGURED)
    const q = mdtSearchQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.issues)
    const svc = ctx.mdtService as unknown as {
      searchVehicles?: (query: string, opts: { limit: number; cursor?: string }) => Promise<unknown>
    }
    if (typeof svc.searchVehicles !== 'function') return reply.code(503).send(NOT_CONFIGURED)
    const result = await svc.searchVehicles(q.data.q, {
      limit: q.data.limit,
      ...(q.data.cursor !== undefined ? { cursor: q.data.cursor } : {}),
    })
    return reply.send(result)
  })
}
