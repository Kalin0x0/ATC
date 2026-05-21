import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  registerWeaponSchema,
  equipWeaponSchema,
  unequipWeaponSchema,
  syncAmmoSchema,
  applyDamageSchema,
  startCombatSessionSchema,
  endCombatSessionSchema,
  applyInjurySchema,
  seizeWeaponSchema,
} from '@atc/operations'
import {
  CombatError,
  WeaponNotFoundError,
  WeaponValidationError,
  WeaponSeizedError,
  WeaponLockedError,
  WeaponAlreadyEquippedError,
  DuplicateDamageError,
  CombatSessionNotFoundError,
  CombatSessionEndedError,
  InjuryNotFoundError,
  InsufficientAmmoError,
} from '@atc/combat-runtime'

function combatErrorToResponse(err: CombatError): { status: number; error: string; message: string } {
  if (err instanceof WeaponValidationError)       return { status: 400, error: 'WeaponValidation',       message: err.message }
  if (err instanceof WeaponSeizedError)           return { status: 422, error: 'WeaponSeized',           message: err.message }
  if (err instanceof WeaponLockedError)           return { status: 422, error: 'WeaponLocked',           message: err.message }
  if (err instanceof CombatSessionEndedError)     return { status: 422, error: 'CombatSessionEnded',     message: err.message }
  if (err instanceof DuplicateDamageError)        return { status: 409, error: 'DuplicateDamage',        message: err.message }
  if (err instanceof WeaponAlreadyEquippedError)  return { status: 409, error: 'WeaponAlreadyEquipped',  message: err.message }
  if (err instanceof InsufficientAmmoError)       return { status: 409, error: 'InsufficientAmmo',       message: err.message }
  if (err instanceof WeaponNotFoundError)         return { status: 404, error: 'WeaponNotFound',         message: err.message }
  if (err instanceof CombatSessionNotFoundError)  return { status: 404, error: 'CombatSessionNotFound',  message: err.message }
  if (err instanceof InjuryNotFoundError)         return { status: 404, error: 'InjuryNotFound',         message: err.message }
  return { status: 500, error: 'CombatError', message: err.message }
}

const NOT_CONFIGURED = { error: 'Combat runtime not configured' }

export async function combatRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Register weapon ───────────────────────────────────────────────────────────

  fastify.post('/api/v1/combat/weapons', {
    preHandler: requireCapability(ctx, 'combat:weapon:register'),
    handler: async (req, reply) => {
      if (!ctx.weaponStateService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = registerWeaponSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const weapon = await ctx.weaponStateService.registerWeapon(parsed.data)
        return reply.status(201).send(weapon)
      } catch (err) {
        if (err instanceof CombatError) return reply.status(combatErrorToResponse(err).status).send(combatErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Get weapon ────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/combat/weapons/:weaponId', {
    preHandler: requireCapability(ctx, 'combat:weapon:read'),
    handler: async (req, reply) => {
      if (!ctx.weaponStateService) return reply.status(503).send(NOT_CONFIGURED)
      const { weaponId } = req.params as { weaponId: string }
      const weapon = await ctx.weaponStateService.getWeapon(weaponId)
      if (!weapon) return reply.status(404).send({ error: 'WeaponNotFound', message: `Weapon ${weaponId} not found` })
      return reply.send(weapon)
    },
  })

  // ── Equip weapon ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/combat/weapons/:weaponId/equip', {
    preHandler: requireCapability(ctx, 'combat:weapon:equip'),
    handler: async (req, reply) => {
      if (!ctx.weaponStateService) return reply.status(503).send(NOT_CONFIGURED)
      const { weaponId } = req.params as { weaponId: string }
      const parsed = equipWeaponSchema.safeParse({ ...req.body as object, weaponId })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const runtime = await ctx.weaponStateService.equip(parsed.data)
        return reply.status(200).send(runtime)
      } catch (err) {
        if (err instanceof CombatError) return reply.status(combatErrorToResponse(err).status).send(combatErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Unequip weapon ────────────────────────────────────────────────────────────

  fastify.post('/api/v1/combat/weapons/:weaponId/unequip', {
    preHandler: requireCapability(ctx, 'combat:weapon:equip'),
    handler: async (req, reply) => {
      if (!ctx.weaponStateService) return reply.status(503).send(NOT_CONFIGURED)
      const { weaponId } = req.params as { weaponId: string }
      const parsed = unequipWeaponSchema.safeParse({ ...req.body as object, weaponId })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const runtime = await ctx.weaponStateService.unequip(parsed.data.weaponId, parsed.data.holderPrincipalId)
        return reply.status(200).send(runtime)
      } catch (err) {
        if (err instanceof CombatError) return reply.status(combatErrorToResponse(err).status).send(combatErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Sync ammo ─────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/combat/weapons/:weaponId/ammo', {
    preHandler: requireCapability(ctx, 'combat:weapon:sync'),
    handler: async (req, reply) => {
      if (!ctx.weaponStateService) return reply.status(503).send(NOT_CONFIGURED)
      const { weaponId } = req.params as { weaponId: string }
      const parsed = syncAmmoSchema.safeParse({ ...req.body as object, weaponId })
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.weaponStateService.syncAmmo(parsed.data.weaponId, parsed.data.holderPrincipalId, parsed.data.currentAmmo)
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof CombatError) return reply.status(combatErrorToResponse(err).status).send(combatErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Seize weapon ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/combat/weapons/:weaponId/seize', {
    preHandler: requireCapability(ctx, 'combat:weapon:seize'),
    handler: async (req, reply) => {
      if (!ctx.weaponStateService) return reply.status(503).send(NOT_CONFIGURED)
      const { weaponId } = req.params as { weaponId: string }
      const parsed = seizeWeaponSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const weapon = await ctx.weaponStateService.seizeWeapon(weaponId, parsed.data.seizedByPrincipalId)
        return reply.status(200).send(weapon)
      } catch (err) {
        if (err instanceof CombatError) return reply.status(combatErrorToResponse(err).status).send(combatErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Apply damage ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/combat/damage', {
    preHandler: requireCapability(ctx, 'combat:damage:apply'),
    handler: async (req, reply) => {
      if (!ctx.damageService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = applyDamageSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const event = await ctx.damageService.applyDamage(parsed.data)
        return reply.status(201).send(event)
      } catch (err) {
        if (err instanceof CombatError) return reply.status(combatErrorToResponse(err).status).send(combatErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Start combat session ──────────────────────────────────────────────────────

  fastify.post('/api/v1/combat/sessions', {
    preHandler: requireCapability(ctx, 'combat:session:manage'),
    handler: async (req, reply) => {
      if (!ctx.combatRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = startCombatSessionSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const session = await ctx.combatRuntimeService.startSession(parsed.data.initiatorPrincipalId)
        return reply.status(201).send(session)
      } catch (err) {
        if (err instanceof CombatError) return reply.status(combatErrorToResponse(err).status).send(combatErrorToResponse(err))
        throw err
      }
    },
  })

  // ── End combat session ────────────────────────────────────────────────────────

  fastify.post('/api/v1/combat/sessions/:sessionId/end', {
    preHandler: requireCapability(ctx, 'combat:session:manage'),
    handler: async (req, reply) => {
      if (!ctx.combatRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const { sessionId } = req.params as { sessionId: string }
      const parsed = endCombatSessionSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const session = await ctx.combatRuntimeService.endSession(sessionId, parsed.data.outcome)
        return reply.status(200).send(session)
      } catch (err) {
        if (err instanceof CombatError) return reply.status(combatErrorToResponse(err).status).send(combatErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Apply injury ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/combat/injuries', {
    preHandler: requireCapability(ctx, 'combat:injury:apply'),
    handler: async (req, reply) => {
      if (!ctx.injuryPropagationService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = applyInjurySchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const injury = await ctx.injuryPropagationService.applyInjury(parsed.data)
        return reply.status(201).send(injury)
      } catch (err) {
        if (err instanceof CombatError) return reply.status(combatErrorToResponse(err).status).send(combatErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Resolve injury ────────────────────────────────────────────────────────────

  fastify.post('/api/v1/combat/injuries/:injuryId/resolve', {
    preHandler: requireCapability(ctx, 'combat:injury:apply'),
    handler: async (req, reply) => {
      if (!ctx.injuryPropagationService) return reply.status(503).send(NOT_CONFIGURED)
      const { injuryId } = req.params as { injuryId: string }
      try {
        const injury = await ctx.injuryPropagationService.resolveInjury(injuryId)
        return reply.status(200).send(injury)
      } catch (err) {
        if (err instanceof CombatError) return reply.status(combatErrorToResponse(err).status).send(combatErrorToResponse(err))
        throw err
      }
    },
  })

  // ── Get active injuries ───────────────────────────────────────────────────────

  fastify.get('/api/v1/combat/injuries/:principalId', {
    preHandler: requireCapability(ctx, 'combat:injury:read'),
    handler: async (req, reply) => {
      if (!ctx.injuryPropagationService) return reply.status(503).send(NOT_CONFIGURED)
      const { principalId } = req.params as { principalId: string }
      const injuries = await ctx.injuryPropagationService.getActiveInjuries(principalId)
      return reply.send(injuries)
    },
  })
}
