import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import type { AppContext } from '../context.js'
import type { AtcVitalName, AtcVitalsChangedEvent } from '@atc/shared-types'
import { validate } from '@atc/schemas'
import {
  vitalsCharacterParamSchema,
  vitalsPatchSchema,
  vitalsMutationSchema,
} from '@atc/schemas'

const VITALS_CHANGED_EVENT = 'atc:vitals:changed'

// ── Guard ─────────────────────────────────────────────────────────────────────

async function requireActiveCharacter(
  characterId: string,
  ctx: AppContext,
  reply: FastifyReply,
): Promise<boolean> {
  const character = await ctx.characters.findById(characterId)
  if (!character) {
    await reply.code(404).send({ error: 'Character not found' })
    return false
  }
  if (character.status !== 'active') {
    await reply.code(403).send({ error: 'Character is not active' })
    return false
  }
  return true
}

// ── Rate limit helper ─────────────────────────────────────────────────────────

async function checkRateLimit(
  characterId: string,
  ctx: AppContext,
  reply: FastifyReply,
): Promise<boolean> {
  const rl = await ctx.vitalsRateLimiter.check(characterId)
  if (rl.error) {
    ctx.logger.warn({ err: rl.error, characterId }, 'vitals rate limiter Redis error — failing open')
  }
  if (!rl.allowed) {
    const retryAfter = rl.retryAfterSeconds ?? 60
    reply.header('Retry-After', String(retryAfter))
    await reply.code(429).send({ error: 'Rate limit exceeded', retryAfterSeconds: retryAfter })
    return false
  }
  return true
}

// ── Routes ────────────────────────────────────────────────────────────────────

export const vitalsRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (fastify, { ctx }) => {
  const { vitals, vitalsCache, eventBus, logger } = ctx

  // ── GET /api/v1/vitals/character/:characterId ─────────────────────────────
  fastify.get<{ Params: { characterId: string } }>(
    '/api/v1/vitals/character/:characterId',
    async (req, reply) => {
      const paramResult = validate(vitalsCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const { characterId } = paramResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      // Redis first, fall through to DB on miss or failure
      try {
        const cached = await vitalsCache.get(characterId)
        if (cached) return reply.code(200).send(cached)
      } catch {
        // Redis failure — non-fatal, continue to DB
      }

      const result = await vitals.getOrCreate(characterId)
      vitalsCache.set(result).catch(() => undefined)
      return reply.code(200).send(result)
    },
  )

  // ── PATCH /api/v1/vitals/character/:characterId ───────────────────────────
  fastify.patch<{ Params: { characterId: string } }>(
    '/api/v1/vitals/character/:characterId',
    async (req, reply) => {
      const paramResult = validate(vitalsCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const bodyResult = validate(vitalsPatchSchema, req.body)
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: bodyResult.errors })
      }
      const { characterId } = paramResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return
      if (!await checkRateLimit(characterId, ctx, reply)) return

      const patch = Object.fromEntries(
        Object.entries(bodyResult.data).filter(([, v]) => v !== undefined),
      ) as Partial<Record<AtcVitalName, number>>
      const result = await vitals.patch(characterId, patch)
      logger.info({ characterId }, 'vitals patch')
      vitalsCache.set(result).catch(() => undefined)

      const event: AtcVitalsChangedEvent = {
        characterId,
        source: 'api',
        timestamp: new Date().toISOString(),
        changed: patch,
        vitals: result,
      }
      eventBus.emit(VITALS_CHANGED_EVENT, event).catch((err: unknown) => {
        logger.warn({ err, characterId }, 'vitals changed event emit failed')
      })

      return reply.code(200).send(result)
    },
  )

  // ── POST /api/v1/vitals/character/:characterId/mutate ─────────────────────
  fastify.post<{ Params: { characterId: string } }>(
    '/api/v1/vitals/character/:characterId/mutate',
    async (req, reply) => {
      const paramResult = validate(vitalsCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const bodyResult = validate(vitalsMutationSchema, req.body)
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: bodyResult.errors })
      }
      const { characterId } = paramResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return
      if (!await checkRateLimit(characterId, ctx, reply)) return

      const { vital, mode, amount } = bodyResult.data
      const result = await vitals.mutate(characterId, vital, mode, amount)
      logger.info({ characterId, vital, mode, amount }, 'vitals mutate')
      vitalsCache.set(result).catch(() => undefined)

      const event: AtcVitalsChangedEvent = {
        characterId,
        source: 'api',
        timestamp: new Date().toISOString(),
        changed: { [vital]: result[vital] } as Partial<Record<AtcVitalName, number>>,
        vitals: result,
      }
      eventBus.emit(VITALS_CHANGED_EVENT, event).catch((err: unknown) => {
        logger.warn({ err, characterId }, 'vitals changed event emit failed')
      })

      return reply.code(200).send(result)
    },
  )

  // ── POST /api/v1/vitals/character/:characterId/reset ──────────────────────
  fastify.post<{ Params: { characterId: string } }>(
    '/api/v1/vitals/character/:characterId/reset',
    async (req, reply) => {
      const paramResult = validate(vitalsCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const { characterId } = paramResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return
      if (!await checkRateLimit(characterId, ctx, reply)) return

      const result = await vitals.reset(characterId)
      logger.info({ characterId }, 'vitals reset')
      vitalsCache.set(result).catch(() => undefined)

      const event: AtcVitalsChangedEvent = {
        characterId,
        source: 'api',
        timestamp: new Date().toISOString(),
        vitals: result,
      }
      eventBus.emit(VITALS_CHANGED_EVENT, event).catch((err: unknown) => {
        logger.warn({ err, characterId }, 'vitals changed event emit failed')
      })

      return reply.code(200).send(result)
    },
  )
}
