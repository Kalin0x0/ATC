import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  spawnNpcSchema,
  despawnNpcSchema,
  recordNpcBehaviorSchema,
  npcHeartbeatSchema,
  updateCrowdDensitySchema,
  cleanupStaleNpcsSchema,
} from '@atc/operations'
import { NpcRuntimeError } from '@atc/npc-runtime'

function npcErrorToStatus(err: NpcRuntimeError): number {
  const name = err.constructor.name
  if (name === 'NpcAlreadyOwnedError' || name === 'NpcSpawnNonceConflictError') return 409
  if (name.endsWith('NotFoundError')) return 404
  return 500
}

const NOT_CONFIGURED = { error: 'NPC runtime not configured' }

export async function npcRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Spawn NPC ─────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/npc/spawn', {
    preHandler: requireCapability(ctx, 'npc:write'),
    handler: async (req, reply) => {
      if (!ctx.dynamicSpawnService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = spawnNpcSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const npcType = (parsed.data.npcType ?? 'civilian') as 'civilian' | 'pedestrian' | 'ambient' | 'scripted' | 'emergency'
        const result = await ctx.dynamicSpawnService.spawnNpc({
          spawnNonce:  parsed.data.spawnNonce,
          npcType,
          ...(parsed.data.zoneId !== undefined ? { zoneId: parsed.data.zoneId } : {}),
          ...(parsed.data.ownerServerId !== undefined ? { ownerServerId: parsed.data.ownerServerId } : {}),
          ...(parsed.data.metadata !== undefined ? { metadata: parsed.data.metadata } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof NpcRuntimeError) return reply.status(npcErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Despawn NPC ───────────────────────────────────────────────────────────────

  fastify.post('/api/v1/npc/despawn', {
    preHandler: requireCapability(ctx, 'npc:write'),
    handler: async (req, reply) => {
      if (!ctx.dynamicSpawnService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = despawnNpcSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.dynamicSpawnService.despawnNpc(
          parsed.data.npcId,
          parsed.data.ownerServerId,
        )
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof NpcRuntimeError) return reply.status(npcErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get NPC ───────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/npc/:npcId', {
    preHandler: requireCapability(ctx, 'npc:read'),
    handler: async (req, reply) => {
      if (!ctx.npcRuntimeRepo) return reply.status(503).send(NOT_CONFIGURED)
      const { npcId } = req.params as { npcId: string }
      const npc = await ctx.npcRuntimeRepo.findById(npcId)
      if (!npc) return reply.status(404).send({ error: 'NpcNotFound' })
      return reply.send(npc)
    },
  })

  // ── NPC heartbeat ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/npc/heartbeat', {
    preHandler: requireCapability(ctx, 'npc:write'),
    handler: async (req, reply) => {
      if (!ctx.npcRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = npcHeartbeatSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.npcRuntimeService.heartbeat(parsed.data.npcId)
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof NpcRuntimeError) return reply.status(npcErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Record NPC behavior ───────────────────────────────────────────────────────

  fastify.post('/api/v1/npc/:npcId/behavior', {
    preHandler: requireCapability(ctx, 'npc:write'),
    handler: async (req, reply) => {
      if (!ctx.ambientBehaviorService) return reply.status(503).send(NOT_CONFIGURED)
      const { npcId } = req.params as { npcId: string }
      const parsed = recordNpcBehaviorSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.ambientBehaviorService.recordBehavior(
          npcId,
          parsed.data.behavior,
          parsed.data.params,
        )
        return reply.send(result)
      } catch (err) {
        if (err instanceof NpcRuntimeError) return reply.status(npcErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Update crowd density ──────────────────────────────────────────────────────

  fastify.post('/api/v1/npc/crowd', {
    preHandler: requireCapability(ctx, 'npc:write'),
    handler: async (req, reply) => {
      if (!ctx.crowdSimulationService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = updateCrowdDensitySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.crowdSimulationService.updateDensity(
          parsed.data.zoneId,
          parsed.data.density,
          parsed.data.targetDensity ?? parsed.data.density,
          parsed.data.activeNpcCount ?? 0,
        )
        return reply.send(result)
      } catch (err) {
        if (err instanceof NpcRuntimeError) return reply.status(npcErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get crowd density for zone ────────────────────────────────────────────────

  fastify.get('/api/v1/npc/crowd/:zoneId', {
    preHandler: requireCapability(ctx, 'npc:read'),
    handler: async (req, reply) => {
      if (!ctx.crowdSimulationService) return reply.status(503).send(NOT_CONFIGURED)
      const { zoneId } = req.params as { zoneId: string }
      const crowd = await ctx.crowdSimulationService.getCrowd(zoneId)
      if (!crowd) return reply.status(404).send({ error: 'CrowdNotFound' })
      return reply.send(crowd)
    },
  })

  // ── Cleanup stale NPCs ────────────────────────────────────────────────────────

  fastify.post('/api/v1/npc/cleanup', {
    preHandler: requireCapability(ctx, 'npc:admin'),
    handler: async (req, reply) => {
      if (!ctx.npcRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = cleanupStaleNpcsSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      const cleaned = await ctx.npcRuntimeService.reconcile([])
      return reply.send({ cleaned })
    },
  })
}
