import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  createGangSchema,
  addGangMemberSchema,
  createOperationSchema,
  operationOutcomeSchema,
  registerContrabandSchema,
  seizeContrabandSchema,
  recordTradeSchema,
  stageRaidSchema,
  completeRaidSchema,
  abortRaidSchema,
} from '@atc/operations'
import {
  CriminalError,
  GangNotFoundError,
  GangValidationError,
  GangAlreadyExistsError,
  GangMemberNotFoundError,
  GangMemberAlreadyActiveError,
  GangOperationNotFoundError,
  GangOperationImmutableError,
  ContrabandNotFoundError,
  ContrabandAlreadySeizedError,
  RaidNotFoundError,
  RaidImmutableError,
  RaidAlreadyActiveError,
  BlackMarketTransactionNotFoundError,
} from '@atc/criminal-runtime'

function criminalErrorToResponse(err: CriminalError): { status: number; error: string; message: string } {
  if (err instanceof GangValidationError)            return { status: 400, error: 'GangValidation',            message: err.message }
  if (err instanceof GangOperationImmutableError)    return { status: 422, error: 'GangOperationImmutable',    message: err.message }
  if (err instanceof RaidImmutableError)             return { status: 422, error: 'RaidImmutable',             message: err.message }
  if (err instanceof GangAlreadyExistsError)         return { status: 409, error: 'GangAlreadyExists',         message: err.message }
  if (err instanceof GangMemberAlreadyActiveError)   return { status: 409, error: 'GangMemberAlreadyActive',   message: err.message }
  if (err instanceof ContrabandAlreadySeizedError)   return { status: 409, error: 'ContrabandAlreadySeized',   message: err.message }
  if (err instanceof RaidAlreadyActiveError)         return { status: 409, error: 'RaidAlreadyActive',         message: err.message }
  if (err instanceof GangNotFoundError)              return { status: 404, error: 'GangNotFound',              message: err.message }
  if (err instanceof GangMemberNotFoundError)        return { status: 404, error: 'GangMemberNotFound',        message: err.message }
  if (err instanceof GangOperationNotFoundError)     return { status: 404, error: 'GangOperationNotFound',     message: err.message }
  if (err instanceof ContrabandNotFoundError)        return { status: 404, error: 'ContrabandNotFound',        message: err.message }
  if (err instanceof RaidNotFoundError)              return { status: 404, error: 'RaidNotFound',              message: err.message }
  if (err instanceof BlackMarketTransactionNotFoundError) return { status: 404, error: 'BlackMarketTransactionNotFound', message: err.message }
  return { status: 500, error: 'CriminalError', message: err.message }
}

const NOT_CONFIGURED = { error: 'Criminal runtime not configured' }

export async function criminalRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Create gang ───────────────────────────────────────────────────────────────

  fastify.post('/api/v1/criminal/gangs', {
    preHandler: requireCapability(ctx, 'criminal:gang:manage'),
    handler: async (req, reply) => {
      if (!ctx.criminalRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = createGangSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const gang = await ctx.criminalRuntimeService.createGang(parsed.data)
        return reply.status(201).send(gang)
      } catch (err) {
        if (err instanceof CriminalError) return reply.status(criminalErrorToResponse(err).status).send(criminalErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Get gang ──────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/criminal/gangs/:gangId', {
    preHandler: requireCapability(ctx, 'criminal:gang:read'),
    handler: async (req, reply) => {
      if (!ctx.criminalRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { gangId } = req.params as { gangId: string }
      const gang = await ctx.criminalRuntimeService.getGang(gangId)
      if (!gang) return reply.status(404).send({ error: 'GangNotFound', message: `Gang ${gangId} not found` })
      return reply.send(gang)
    },
  })

  // ── List active gangs ─────────────────────────────────────────────────────────

  fastify.get('/api/v1/criminal/gangs', {
    preHandler: requireCapability(ctx, 'criminal:gang:read'),
    handler: async (req, reply) => {
      if (!ctx.criminalRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const gangs = await ctx.criminalRuntimeService.listActiveGangs()
      return reply.send(gangs)
    },
  })

  // ── Add gang member ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/criminal/gangs/:gangId/members', {
    preHandler: requireCapability(ctx, 'criminal:gang:manage'),
    handler: async (req, reply) => {
      if (!ctx.criminalRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { gangId } = req.params as { gangId: string }
      const parsed = addGangMemberSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const member = await ctx.criminalRuntimeService.addMember(gangId, parsed.data.principalId, parsed.data.rank, parsed.data.invitedByPrincipalId)
        return reply.status(201).send(member)
      } catch (err) {
        if (err instanceof CriminalError) return reply.status(criminalErrorToResponse(err).status).send(criminalErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Remove gang member ────────────────────────────────────────────────────────

  fastify.delete('/api/v1/criminal/gangs/:gangId/members/:principalId', {
    preHandler: requireCapability(ctx, 'criminal:gang:manage'),
    handler: async (req, reply) => {
      if (!ctx.criminalRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { gangId, principalId } = req.params as { gangId: string; principalId: string }
      try {
        const member = await ctx.criminalRuntimeService.removeMember(gangId, principalId)
        return reply.status(200).send(member)
      } catch (err) {
        if (err instanceof CriminalError) return reply.status(criminalErrorToResponse(err).status).send(criminalErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Create operation ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/criminal/operations', {
    preHandler: requireCapability(ctx, 'criminal:operation:manage'),
    handler: async (req, reply) => {
      if (!ctx.gangOperationService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = createOperationSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const op = await ctx.gangOperationService.createOperation(parsed.data)
        return reply.status(201).send(op)
      } catch (err) {
        if (err instanceof CriminalError) return reply.status(criminalErrorToResponse(err).status).send(criminalErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Start operation ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/criminal/operations/:operationId/start', {
    preHandler: requireCapability(ctx, 'criminal:operation:manage'),
    handler: async (req, reply) => {
      if (!ctx.gangOperationService) return reply.status(503).send(NOT_CONFIGURED)
      const { operationId } = req.params as { operationId: string }
      try {
        const op = await ctx.gangOperationService.startOperation(operationId)
        return reply.status(200).send(op)
      } catch (err) {
        if (err instanceof CriminalError) return reply.status(criminalErrorToResponse(err).status).send(criminalErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Complete operation ────────────────────────────────────────────────────────

  fastify.post('/api/v1/criminal/operations/:operationId/complete', {
    preHandler: requireCapability(ctx, 'criminal:operation:manage'),
    handler: async (req, reply) => {
      if (!ctx.gangOperationService) return reply.status(503).send(NOT_CONFIGURED)
      const { operationId } = req.params as { operationId: string }
      const parsed = operationOutcomeSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const op = await ctx.gangOperationService.completeOperation(operationId, parsed.data.outcome)
        return reply.status(200).send(op)
      } catch (err) {
        if (err instanceof CriminalError) return reply.status(criminalErrorToResponse(err).status).send(criminalErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Abort operation ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/criminal/operations/:operationId/abort', {
    preHandler: requireCapability(ctx, 'criminal:operation:manage'),
    handler: async (req, reply) => {
      if (!ctx.gangOperationService) return reply.status(503).send(NOT_CONFIGURED)
      const { operationId } = req.params as { operationId: string }
      try {
        const op = await ctx.gangOperationService.abortOperation(operationId)
        return reply.status(200).send(op)
      } catch (err) {
        if (err instanceof CriminalError) return reply.status(criminalErrorToResponse(err).status).send(criminalErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Register contraband ───────────────────────────────────────────────────────

  fastify.post('/api/v1/criminal/contraband', {
    preHandler: requireCapability(ctx, 'criminal:contraband:manage'),
    handler: async (req, reply) => {
      if (!ctx.contrabandService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = registerContrabandSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const contraband = await ctx.contrabandService.register(parsed.data)
        return reply.status(201).send(contraband)
      } catch (err) {
        if (err instanceof CriminalError) return reply.status(criminalErrorToResponse(err).status).send(criminalErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Seize contraband ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/criminal/contraband/:contrabandId/seize', {
    preHandler: requireCapability(ctx, 'criminal:contraband:seize'),
    handler: async (req, reply) => {
      if (!ctx.contrabandService) return reply.status(503).send(NOT_CONFIGURED)
      const { contrabandId } = req.params as { contrabandId: string }
      const parsed = seizeContrabandSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const contraband = await ctx.contrabandService.seize(contrabandId, parsed.data.seizedByPrincipalId)
        return reply.status(200).send(contraband)
      } catch (err) {
        if (err instanceof CriminalError) return reply.status(criminalErrorToResponse(err).status).send(criminalErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Record black market trade ─────────────────────────────────────────────────

  fastify.post('/api/v1/criminal/trade', {
    preHandler: requireCapability(ctx, 'criminal:trade:record'),
    handler: async (req, reply) => {
      if (!ctx.blackMarketService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = recordTradeSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const trade = await ctx.blackMarketService.recordTrade(parsed.data)
        return reply.status(201).send(trade)
      } catch (err) {
        if (err instanceof CriminalError) return reply.status(criminalErrorToResponse(err).status).send(criminalErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Stage raid ────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/criminal/raids', {
    preHandler: requireCapability(ctx, 'criminal:raid:manage'),
    handler: async (req, reply) => {
      if (!ctx.raidRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = stageRaidSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const raid = await ctx.raidRuntimeService.stageRaid(parsed.data)
        return reply.status(201).send(raid)
      } catch (err) {
        if (err instanceof CriminalError) return reply.status(criminalErrorToResponse(err).status).send(criminalErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Start raid ────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/criminal/raids/:raidId/start', {
    preHandler: requireCapability(ctx, 'criminal:raid:manage'),
    handler: async (req, reply) => {
      if (!ctx.raidRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { raidId } = req.params as { raidId: string }
      try {
        const raid = await ctx.raidRuntimeService.startRaid(raidId)
        return reply.status(200).send(raid)
      } catch (err) {
        if (err instanceof CriminalError) return reply.status(criminalErrorToResponse(err).status).send(criminalErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Complete raid ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/criminal/raids/:raidId/complete', {
    preHandler: requireCapability(ctx, 'criminal:raid:manage'),
    handler: async (req, reply) => {
      if (!ctx.raidRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { raidId } = req.params as { raidId: string }
      const parsed = completeRaidSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const raid = await ctx.raidRuntimeService.completeRaid(raidId, parsed.data.outcome, parsed.data.notes)
        return reply.status(200).send(raid)
      } catch (err) {
        if (err instanceof CriminalError) return reply.status(criminalErrorToResponse(err).status).send(criminalErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Abort raid ────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/criminal/raids/:raidId/abort', {
    preHandler: requireCapability(ctx, 'criminal:raid:manage'),
    handler: async (req, reply) => {
      if (!ctx.raidRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { raidId } = req.params as { raidId: string }
      const parsed = abortRaidSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const raid = await ctx.raidRuntimeService.abortRaid(raidId, parsed.data.notes)
        return reply.status(200).send(raid)
      } catch (err) {
        if (err instanceof CriminalError) return reply.status(criminalErrorToResponse(err).status).send(criminalErrorToResponse(err))
        throw err
      }
    },
  })
}
