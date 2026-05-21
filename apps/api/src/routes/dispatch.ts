import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  createDispatchCallSchema,
  listDispatchCallsQuerySchema,
  acceptDispatchCallSchema,
  createIncidentSchema,
  listIncidentsQuerySchema,
  addIncidentNoteSchema,
  assignResponderSchema,
  updateResponderStatusSchema,
  createBoloSchema,
  listBolosQuerySchema,
  addBoloNoteSchema,
} from '@atc/operations'
import {
  DispatchError,
  DispatchValidationError,
  DispatchCallNotFoundError,
  DispatchCallImmutableError,
  IncidentNotFoundError,
  IncidentImmutableError,
  ResponderAssignmentNotFoundError,
  ResponderAssignmentImmutableError,
  BoloNotFoundError,
  BoloImmutableError,
} from '@atc/dispatch'

function dispatchErrorToResponse(err: DispatchError): { status: number; error: string; message: string } {
  if (err instanceof DispatchValidationError)            return { status: 400, error: 'DispatchValidation',         message: err.message }
  if (err instanceof DispatchCallImmutableError)         return { status: 422, error: 'DispatchCallImmutable',       message: err.message }
  if (err instanceof IncidentImmutableError)             return { status: 422, error: 'IncidentImmutable',           message: err.message }
  if (err instanceof ResponderAssignmentImmutableError)  return { status: 422, error: 'ResponderImmutable',          message: err.message }
  if (err instanceof BoloImmutableError)                 return { status: 422, error: 'BoloImmutable',               message: err.message }
  if (err instanceof DispatchCallNotFoundError)          return { status: 404, error: 'DispatchCallNotFound',        message: err.message }
  if (err instanceof IncidentNotFoundError)              return { status: 404, error: 'IncidentNotFound',            message: err.message }
  if (err instanceof ResponderAssignmentNotFoundError)   return { status: 404, error: 'ResponderAssignmentNotFound', message: err.message }
  if (err instanceof BoloNotFoundError)                  return { status: 404, error: 'BoloNotFound',                message: err.message }
  return { status: 500, error: 'DispatchError', message: err.message }
}

const NOT_CONFIGURED = { error: 'Dispatch system not configured' }

export async function dispatchRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Dispatch Calls ──────────────────────────────────────────────────────────

  fastify.get('/api/v1/dispatch/calls', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.dispatchCallRepo) return reply.code(503).send(NOT_CONFIGURED)
    const result = listDispatchCallsQuerySchema.safeParse(req.query)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    const page = await ctx.dispatchCallRepo.list(result.data)
    return reply.send(page)
  })

  fastify.post('/api/v1/dispatch/calls', {
    preHandler: requireCapability(ctx, 'dispatch.write'),
  }, async (req, reply) => {
    if (!ctx.dispatchService) return reply.code(503).send(NOT_CONFIGURED)
    const result = createDispatchCallSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const call = await ctx.dispatchService.createCall(result.data)
      return reply.code(201).send(call)
    } catch (err) {
      if (err instanceof DispatchError) { const r = dispatchErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.get('/api/v1/dispatch/calls/:id', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.dispatchCallRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const call = await ctx.dispatchCallRepo.findById(id)
    if (!call) return reply.code(404).send({ error: 'DispatchCallNotFound', message: `Dispatch call not found: ${id}` })
    return reply.send(call)
  })

  fastify.post('/api/v1/dispatch/calls/:id/accept', {
    preHandler: requireCapability(ctx, 'dispatch.manage'),
  }, async (req, reply) => {
    if (!ctx.dispatchService) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const result = acceptDispatchCallSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const call = await ctx.dispatchService.acceptCall(id, result.data.incidentId)
      return reply.send(call)
    } catch (err) {
      if (err instanceof DispatchError) { const r = dispatchErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── Incidents ───────────────────────────────────────────────────────────────

  fastify.get('/api/v1/dispatch/incidents', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.incidentRepo) return reply.code(503).send(NOT_CONFIGURED)
    const result = listIncidentsQuerySchema.safeParse(req.query)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    const page = await ctx.incidentRepo.list(result.data)
    return reply.send(page)
  })

  fastify.post('/api/v1/dispatch/incidents', {
    preHandler: requireCapability(ctx, 'dispatch.write'),
  }, async (req, reply) => {
    if (!ctx.dispatchService) return reply.code(503).send(NOT_CONFIGURED)
    const result = createIncidentSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const incident = await ctx.dispatchService.createIncident(result.data)
      return reply.code(201).send(incident)
    } catch (err) {
      if (err instanceof DispatchError) { const r = dispatchErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.get('/api/v1/dispatch/incidents/:id', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.incidentRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const incident = await ctx.incidentRepo.findById(id)
    if (!incident) return reply.code(404).send({ error: 'IncidentNotFound', message: `Incident not found: ${id}` })
    return reply.send(incident)
  })

  fastify.post('/api/v1/dispatch/incidents/:id/escalate', {
    preHandler: requireCapability(ctx, 'dispatch.manage'),
  }, async (req, reply) => {
    if (!ctx.dispatchService) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    try {
      const incident = await ctx.dispatchService.escalateIncident(id)
      return reply.send(incident)
    } catch (err) {
      if (err instanceof DispatchError) { const r = dispatchErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/dispatch/incidents/:id/resolve', {
    preHandler: requireCapability(ctx, 'dispatch.manage'),
  }, async (req, reply) => {
    if (!ctx.dispatchService) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    try {
      const incident = await ctx.dispatchService.resolveIncident(id)
      return reply.send(incident)
    } catch (err) {
      if (err instanceof DispatchError) { const r = dispatchErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/dispatch/incidents/:id/notes', {
    preHandler: requireCapability(ctx, 'dispatch.write'),
  }, async (req, reply) => {
    if (!ctx.dispatchService) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const result = addIncidentNoteSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const incident = await ctx.dispatchService.addIncidentNote({ incidentId: id, ...result.data })
      return reply.send(incident)
    } catch (err) {
      if (err instanceof DispatchError) { const r = dispatchErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── Responders ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/dispatch/incidents/:id/responders', {
    preHandler: requireCapability(ctx, 'responder.manage'),
  }, async (req, reply) => {
    if (!ctx.dispatchService) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const result = assignResponderSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const assignment = await ctx.dispatchService.assignResponder({ incidentId: id, ...result.data })
      return reply.code(201).send(assignment)
    } catch (err) {
      if (err instanceof DispatchError) { const r = dispatchErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.patch('/api/v1/dispatch/responders/:id/status', {
    preHandler: requireCapability(ctx, 'responder.manage'),
  }, async (req, reply) => {
    if (!ctx.dispatchService) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const result = updateResponderStatusSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const assignment = await ctx.dispatchService.updateResponderStatus(id, result.data.status)
      return reply.send(assignment)
    } catch (err) {
      if (err instanceof DispatchError) { const r = dispatchErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── BOLOs ────────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/dispatch/bolos', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.boloRepo) return reply.code(503).send(NOT_CONFIGURED)
    const result = listBolosQuerySchema.safeParse(req.query)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    const page = await ctx.boloRepo.list(result.data)
    return reply.send(page)
  })

  fastify.post('/api/v1/dispatch/bolos', {
    preHandler: requireCapability(ctx, 'bolo.manage'),
  }, async (req, reply) => {
    if (!ctx.dispatchService) return reply.code(503).send(NOT_CONFIGURED)
    const result = createBoloSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const { expiresAt, ...rest } = result.data
      const bolo = await ctx.dispatchService.createBolo({
        ...rest,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      })
      return reply.code(201).send(bolo)
    } catch (err) {
      if (err instanceof DispatchError) { const r = dispatchErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.get('/api/v1/dispatch/bolos/:id', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.boloRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const bolo = await ctx.boloRepo.findById(id)
    if (!bolo) return reply.code(404).send({ error: 'BoloNotFound', message: `BOLO not found: ${id}` })
    return reply.send(bolo)
  })

  fastify.post('/api/v1/dispatch/bolos/:id/expire', {
    preHandler: requireCapability(ctx, 'bolo.manage'),
  }, async (req, reply) => {
    if (!ctx.dispatchService) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    try {
      const bolo = await ctx.dispatchService.expireBolo(id)
      return reply.send(bolo)
    } catch (err) {
      if (err instanceof DispatchError) { const r = dispatchErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/dispatch/bolos/:id/notes', {
    preHandler: requireCapability(ctx, 'bolo.manage'),
  }, async (req, reply) => {
    if (!ctx.boloRepo) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const result = addBoloNoteSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const bolo = await ctx.boloRepo.addNote({ boloId: id, ...result.data })
      return reply.send(bolo)
    } catch (err) {
      if (err instanceof DispatchError) { const r = dispatchErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── MDT ──────────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/mdt/character/:characterId', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.mdtService) return reply.code(503).send(NOT_CONFIGURED)
    const { characterId } = req.params as { characterId: string }
    const profile = await ctx.mdtService.getCharacterProfile(characterId)
    return reply.send(profile)
  })

  fastify.get('/api/v1/mdt/situation/:agencyId', {
    preHandler: requireCapability(ctx, 'dispatch.read'),
  }, async (req, reply) => {
    if (!ctx.mdtService) return reply.code(503).send(NOT_CONFIGURED)
    const { agencyId } = req.params as { agencyId: string }
    const snapshot = await ctx.mdtService.getSituationSnapshot(agencyId)
    return reply.send(snapshot)
  })
}
