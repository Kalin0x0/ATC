import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import {
  startCombatSimulationSchema,
  endCombatSimulationSchema,
  recordBallisticImpactSchema,
  applyTacticalDamageSchema,
  applySuppressionSchema,
  upsertArmorSchema,
  cleanupCombatSchema,
} from '@atc/operations'

export function combatSimulationRoutes(fastify: FastifyInstance, { ctx }: { ctx: AppContext }) {
  // ── Combat Sessions ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/combat-simulation/sessions/start', async (req, reply) => {
    if (!ctx.combatSimulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = startCombatSimulationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { targetId, regionId, combatData, ...rest } = parsed.data
    const session = await ctx.combatSimulationService.startCombat({
      ...rest,
      targetId: targetId ?? '',
      regionId: regionId ?? '',
      status: 'active',
      startedAt: new Date(),
      ...(combatData !== undefined ? { combatData } : {}),
    })
    return reply.code(200).send(session)
  })

  fastify.post('/api/v1/combat-simulation/sessions/:id/end', async (req, reply) => {
    if (!ctx.combatSimulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = endCombatSimulationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { id } = req.params as { id: string }
    const session = await ctx.combatSimulationService.endCombat(id)
    return reply.code(200).send(session)
  })

  fastify.get('/api/v1/combat-simulation/sessions/:id', async (req, reply) => {
    if (!ctx.combatSimulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const session = await ctx.combatSimulationService.getSession(id)
    if (!session) return reply.code(404).send({ error: 'Session not found' })
    return reply.code(200).send(session)
  })

  fastify.get('/api/v1/combat-simulation/sessions/active', async (req, reply) => {
    if (!ctx.combatSimulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { ownerServerId } = req.query as { ownerServerId?: string }
    const sessions = await ctx.combatSimulationService.listActiveSessions(ownerServerId)
    return reply.code(200).send(sessions)
  })

  // ── Ballistics ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/combat-simulation/ballistics/record', async (req, reply) => {
    if (!ctx.ballisticsRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = recordBallisticImpactSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { trajectoryData, impactData, velocity, penetrationDepth, ...rest } = parsed.data
    const record = await ctx.ballisticsRuntimeService.recordImpact({
      ...rest,
      velocity: velocity ?? 0,
      penetrationDepth: penetrationDepth ?? 0,
      ...(trajectoryData !== undefined ? { trajectoryData } : {}),
      ...(impactData !== undefined ? { impactData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.post('/api/v1/combat-simulation/ballistics/:id/resolve', async (req, reply) => {
    if (!ctx.ballisticsRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { id } = req.params as { id: string }
    const record = await ctx.ballisticsRuntimeService.resolveImpact(id)
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/combat-simulation/ballistics/pending/:sessionId', async (req, reply) => {
    if (!ctx.ballisticsRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { sessionId } = req.params as { sessionId: string }
    const records = await ctx.ballisticsRuntimeService.listPendingBySession(sessionId)
    return reply.code(200).send(records)
  })

  // ── Tactical Damage ─────────────────────────────────────────────────────────

  fastify.post('/api/v1/combat-simulation/damage/apply', async (req, reply) => {
    if (!ctx.tacticalDamageService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = applyTacticalDamageSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { attackerId, bodyZone, damageData, ...rest } = parsed.data
    const record = await ctx.tacticalDamageService.applyDamage({
      ...rest,
      ...(attackerId !== undefined ? { attackerId } : {}),
      ...(bodyZone !== undefined ? { bodyZone } : {}),
      ...(damageData !== undefined ? { damageData } : {}),
    })
    return reply.code(200).send(record)
  })

  // ── Suppression ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/combat-simulation/suppression/apply', async (req, reply) => {
    if (!ctx.suppressionRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = applySuppressionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { suppressorId, regionId, expiresAt, ...rest } = parsed.data
    const record = await ctx.suppressionRuntimeService.applySuppression({
      ...rest,
      ...(suppressorId !== undefined ? { suppressorId } : {}),
      ...(regionId !== undefined ? { regionId } : {}),
      ...(expiresAt !== undefined ? { expiresAt: new Date(expiresAt) } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/combat-simulation/suppression/:entityId', async (req, reply) => {
    if (!ctx.suppressionRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const record = await ctx.suppressionRuntimeService.getSuppression(entityId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  fastify.delete('/api/v1/combat-simulation/suppression/:entityId', async (req, reply) => {
    if (!ctx.suppressionRuntimeService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    await ctx.suppressionRuntimeService.clearSuppression(entityId)
    return reply.code(204).send()
  })

  // ── Armor ───────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/combat-simulation/armor/upsert', async (req, reply) => {
    if (!ctx.armorPenetrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = upsertArmorSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { armorData, ...rest } = parsed.data
    const record = await ctx.armorPenetrationService.upsertArmor({
      ...rest,
      ...(armorData !== undefined ? { armorData } : {}),
    })
    return reply.code(200).send(record)
  })

  fastify.get('/api/v1/combat-simulation/armor/:entityId', async (req, reply) => {
    if (!ctx.armorPenetrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    const record = await ctx.armorPenetrationService.getArmor(entityId)
    if (!record) return reply.code(404).send({ error: 'Not found' })
    return reply.code(200).send(record)
  })

  fastify.delete('/api/v1/combat-simulation/armor/:entityId', async (req, reply) => {
    if (!ctx.armorPenetrationService) return reply.code(503).send({ error: 'Service unavailable' })
    const { entityId } = req.params as { entityId: string }
    await ctx.armorPenetrationService.deactivateArmor(entityId)
    return reply.code(204).send()
  })

  // ── Maintenance ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/combat-simulation/cleanup', async (req, reply) => {
    if (!ctx.combatSimulationService) return reply.code(503).send({ error: 'Service unavailable' })
    const parsed = cleanupCombatSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const count = await ctx.combatSimulationService.cleanupStale(parsed.data.thresholdMs)
    return reply.code(200).send({ count })
  })
}
