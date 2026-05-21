import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  createFactionSchema,
  claimTerritorySchema,
  startConflictSchema,
  resolveConflictSchema,
  captureResourceNodeSchema,
  addFactionMemberSchema,
} from '@atc/operations'
import {
  FactionError,
} from '@atc/faction-runtime'

function factionErrorToStatus(err: FactionError): number {
  const name = err.constructor.name
  if (name === 'FactionValidationError') return 400
  if (name === 'TerritoryClaimImmutableError' || name === 'ConflictImmutableError') return 422
  if (name === 'FactionAlreadyExistsError' || name === 'FactionMemberAlreadyActiveError' || name === 'TerritoryAlreadyClaimedError' || name === 'ConflictAlreadyActiveError' || name === 'ResourceNodeAlreadyOwnedError') return 409
  if (name.endsWith('NotFoundError')) return 404
  return 500
}

const NOT_CONFIGURED = { error: 'Faction runtime not configured' }

export async function factionRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Create faction ────────────────────────────────────────────────────────────

  fastify.post('/api/v1/factions', {
    preHandler: requireCapability(ctx, 'faction:write'),
    handler: async (req, reply) => {
      if (!ctx.factionRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = createFactionSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.factionRuntimeService.createFaction(parsed.data)
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof FactionError) return reply.status(factionErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get faction ───────────────────────────────────────────────────────────────

  fastify.get('/api/v1/factions/:factionId', {
    preHandler: requireCapability(ctx, 'faction:read'),
    handler: async (req, reply) => {
      if (!ctx.factionRepo) return reply.status(503).send(NOT_CONFIGURED)
      const { factionId } = req.params as { factionId: string }
      const faction = await ctx.factionRepo.findById(factionId)
      if (!faction) return reply.status(404).send({ error: 'FactionNotFound' })
      return reply.send(faction)
    },
  })

  // ── Add faction member ────────────────────────────────────────────────────────

  fastify.post('/api/v1/factions/:factionId/members', {
    preHandler: requireCapability(ctx, 'faction:member:write'),
    handler: async (req, reply) => {
      if (!ctx.factionRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = addFactionMemberSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.factionRuntimeService.addMember(parsed.data.factionId, parsed.data.principalId, 'member')
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof FactionError) return reply.status(factionErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Disband faction ───────────────────────────────────────────────────────────

  fastify.delete('/api/v1/factions/:factionId', {
    preHandler: requireCapability(ctx, 'faction:write'),
    handler: async (req, reply) => {
      if (!ctx.factionRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { factionId } = req.params as { factionId: string }
      try {
        await ctx.factionRuntimeService.disbandFaction(factionId)
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof FactionError) return reply.status(factionErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Claim territory ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/factions/territories/claim', {
    preHandler: requireCapability(ctx, 'faction:territory:write'),
    handler: async (req, reply) => {
      if (!ctx.territoryControlService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = claimTerritorySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.territoryControlService.claimTerritory(
          parsed.data.territoryId,
          parsed.data.factionId,
          parsed.data.claimedByPrincipalId,
          parsed.data.claimNonce,
          parsed.data.claimType,
        )
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof FactionError) return reply.status(factionErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get territory ─────────────────────────────────────────────────────────────

  fastify.get('/api/v1/factions/territories/:territoryId', {
    preHandler: requireCapability(ctx, 'faction:territory:read'),
    handler: async (req, reply) => {
      if (!ctx.territoryRepo) return reply.status(503).send(NOT_CONFIGURED)
      const { territoryId } = req.params as { territoryId: string }
      const territory = await ctx.territoryRepo.findByTerritoryId(territoryId)
      if (!territory) return reply.status(404).send({ error: 'TerritoryNotFound' })
      return reply.send(territory)
    },
  })

  // ── Start conflict ────────────────────────────────────────────────────────────

  fastify.post('/api/v1/factions/conflicts', {
    preHandler: requireCapability(ctx, 'faction:conflict:write'),
    handler: async (req, reply) => {
      if (!ctx.conflictRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = startConflictSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.conflictRuntimeService.startConflict(parsed.data)
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof FactionError) return reply.status(factionErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Resolve conflict ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/factions/conflicts/:conflictId/resolve', {
    preHandler: requireCapability(ctx, 'faction:conflict:write'),
    handler: async (req, reply) => {
      if (!ctx.conflictRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = resolveConflictSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const { conflictId } = req.params as { conflictId: string }
        const result = await ctx.conflictRuntimeService.resolveConflict(conflictId, parsed.data.outcome, parsed.data.notes)
        return reply.send(result)
      } catch (err) {
        if (err instanceof FactionError) return reply.status(factionErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Capture resource node ─────────────────────────────────────────────────────

  fastify.post('/api/v1/factions/resource-nodes/capture', {
    preHandler: requireCapability(ctx, 'faction:resource:write'),
    handler: async (req, reply) => {
      if (!ctx.resourceNodeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = captureResourceNodeSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.resourceNodeService.captureNode(
          parsed.data.nodeId,
          parsed.data.factionId,
          parsed.data.capturingPrincipalId,
        )
        return reply.send(result)
      } catch (err) {
        if (err instanceof FactionError) return reply.status(factionErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get resource node ─────────────────────────────────────────────────────────

  fastify.get('/api/v1/factions/resource-nodes/:nodeId', {
    preHandler: requireCapability(ctx, 'faction:resource:read'),
    handler: async (req, reply) => {
      if (!ctx.resourceNodeRepo) return reply.status(503).send(NOT_CONFIGURED)
      const { nodeId } = req.params as { nodeId: string }
      const node = await ctx.resourceNodeRepo.findByNodeId(nodeId)
      if (!node) return reply.status(404).send({ error: 'ResourceNodeNotFound' })
      return reply.send(node)
    },
  })

  // ── Get influence ─────────────────────────────────────────────────────────────

  fastify.get('/api/v1/factions/:factionId/influence', {
    preHandler: requireCapability(ctx, 'faction:influence:read'),
    handler: async (req, reply) => {
      if (!ctx.influenceRepo) return reply.status(503).send(NOT_CONFIGURED)
      const { factionId } = req.params as { factionId: string }
      const records = await ctx.influenceRepo.listByFaction(factionId)
      return reply.send(records)
    },
  })
}
