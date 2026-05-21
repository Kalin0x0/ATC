import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  createEmergencySchema,
  triageEmergencySchema,
  assignEmergencySchema,
  stabilizeEmergencySchema,
  transportEmergencySchema,
  closeEmergencySchema,
} from '@atc/operations'
import {
  EmsError,
  EmsValidationError,
  EmergencyNotFoundError,
  EmergencyClosedError,
  EmergencyImmutableError,
  AmbulanceNotFoundError,
  AmbulanceUnavailableError,
  HospitalCapacityNotFoundError,
  HospitalAtCapacityError,
  ReviveCooldownError,
  TriageValidationError,
} from '@atc/ems-runtime'

function emsErrorToResponse(err: EmsError): { status: number; error: string; message: string } {
  if (err instanceof EmsValidationError)           return { status: 400, error: 'EmsValidation',           message: err.message }
  if (err instanceof TriageValidationError)        return { status: 400, error: 'TriageValidation',        message: err.message }
  if (err instanceof EmergencyImmutableError)      return { status: 422, error: 'EmergencyImmutable',      message: err.message }
  if (err instanceof EmergencyClosedError)         return { status: 422, error: 'EmergencyClosed',         message: err.message }
  if (err instanceof AmbulanceUnavailableError)    return { status: 409, error: 'AmbulanceUnavailable',    message: err.message }
  if (err instanceof HospitalAtCapacityError)      return { status: 409, error: 'HospitalAtCapacity',      message: err.message }
  if (err instanceof ReviveCooldownError)          return { status: 429, error: 'ReviveCooldown',          message: err.message }
  if (err instanceof EmergencyNotFoundError)       return { status: 404, error: 'EmergencyNotFound',       message: err.message }
  if (err instanceof AmbulanceNotFoundError)       return { status: 404, error: 'AmbulanceNotFound',       message: err.message }
  if (err instanceof HospitalCapacityNotFoundError) return { status: 404, error: 'HospitalCapacityNotFound', message: err.message }
  return { status: 500, error: 'EmsError', message: err.message }
}

const NOT_CONFIGURED = { error: 'EMS runtime not configured' }

export async function emsRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Emergencies ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/ems/emergencies', {
    preHandler: requireCapability(ctx, 'ems.write'),
  }, async (req, reply) => {
    if (!ctx.emsRuntimeService) return reply.code(503).send(NOT_CONFIGURED)
    const result = createEmergencySchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const emergency = await ctx.emsRuntimeService.createEmergency(result.data)
      return reply.code(201).send(emergency)
    } catch (err) {
      if (err instanceof EmsError) { const r = emsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.get('/api/v1/ems/emergencies/active', {
    preHandler: requireCapability(ctx, 'ems.read'),
  }, async (req, reply) => {
    if (!ctx.emsRuntimeService) return reply.code(503).send(NOT_CONFIGURED)
    const emergencies = await ctx.emsRuntimeService.listActive()
    return reply.send(emergencies)
  })

  fastify.get('/api/v1/ems/emergencies/:id', {
    preHandler: requireCapability(ctx, 'ems.read'),
  }, async (req, reply) => {
    if (!ctx.emsRuntimeService) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const emergency = await ctx.emsRuntimeService.findById(id)
    if (!emergency) return reply.code(404).send({ error: 'EmergencyNotFound', message: `EMS emergency not found: ${id}` })
    return reply.send(emergency)
  })

  fastify.post('/api/v1/ems/emergencies/:id/triage', {
    preHandler: requireCapability(ctx, 'ems.triage'),
  }, async (req, reply) => {
    if (!ctx.emsRuntimeService) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const result = triageEmergencySchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const emergency = await ctx.emsRuntimeService.triage(id, result.data)
      return reply.send(emergency)
    } catch (err) {
      if (err instanceof EmsError) { const r = emsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/ems/emergencies/:id/assign', {
    preHandler: requireCapability(ctx, 'ems.dispatch'),
  }, async (req, reply) => {
    if (!ctx.emsRuntimeService) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const result = assignEmergencySchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const emergency = await ctx.emsRuntimeService.assignResponder(id, result.data)
      return reply.send(emergency)
    } catch (err) {
      if (err instanceof EmsError) { const r = emsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/ems/emergencies/:id/stabilize', {
    preHandler: requireCapability(ctx, 'ems.write'),
  }, async (req, reply) => {
    if (!ctx.emsRuntimeService) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const result = stabilizeEmergencySchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const emergency = await ctx.emsRuntimeService.stabilize(id, result.data)
      return reply.send(emergency)
    } catch (err) {
      if (err instanceof EmsError) { const r = emsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/ems/emergencies/:id/transport', {
    preHandler: requireCapability(ctx, 'ems.write'),
  }, async (req, reply) => {
    if (!ctx.emsRuntimeService) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const result = transportEmergencySchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const emergency = await ctx.emsRuntimeService.transport(id, result.data)
      return reply.send(emergency)
    } catch (err) {
      if (err instanceof EmsError) { const r = emsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  fastify.post('/api/v1/ems/emergencies/:id/close', {
    preHandler: requireCapability(ctx, 'ems.write'),
  }, async (req, reply) => {
    if (!ctx.emsRuntimeService) return reply.code(503).send(NOT_CONFIGURED)
    const { id } = req.params as { id: string }
    const result = closeEmergencySchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const emergency = await ctx.emsRuntimeService.close(id, result.data)
      return reply.send(emergency)
    } catch (err) {
      if (err instanceof EmsError) { const r = emsErrorToResponse(err); return reply.code(r.status).send(r) }
      throw err
    }
  })

  // ── Hospital Capacity ────────────────────────────────────────────────────────

  fastify.get('/api/v1/ems/hospitals/capacity', {
    preHandler: requireCapability(ctx, 'ems.read'),
  }, async (req, reply) => {
    if (!ctx.emsRuntimeService) return reply.code(503).send(NOT_CONFIGURED)
    const capacities = await ctx.emsRuntimeService.getHospitalCapacity()
    return reply.send(capacities)
  })

  // ── Active Responders ─────────────────────────────────────────────────────────

  fastify.get('/api/v1/ems/responders/active', {
    preHandler: requireCapability(ctx, 'ems.read'),
  }, async (req, reply) => {
    if (!ctx.emsRuntimeService) return reply.code(503).send(NOT_CONFIGURED)
    const responders = await ctx.emsRuntimeService.listActiveResponders()
    return reply.send(responders)
  })
}
