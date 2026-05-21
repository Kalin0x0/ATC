import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import type { AppContext } from '../context.js'
import type { AtcStatusEffect, AtcStatusEffectType } from '@atc/shared-types'
import { validate } from '@atc/schemas'
import {
  statusEffectCharacterParamSchema,
  statusEffectTypeParamSchema,
  applyStatusEffectSchema,
} from '@atc/schemas'

const STATUS_CHANGED_EVENT = 'atc:status:changed'

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

// ── Routes ────────────────────────────────────────────────────────────────────

export const statusEffectsRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  fastify,
  { ctx },
) => {
  const { statusEffectsCache, eventBus, logger } = ctx

  // ── GET /api/v1/status-effects/character/:characterId ─────────────────────
  fastify.get<{ Params: { characterId: string } }>(
    '/api/v1/status-effects/character/:characterId',
    async (req, reply) => {
      const paramResult = validate(statusEffectCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const { characterId } = paramResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      let effects: AtcStatusEffect[]
      try {
        effects = await statusEffectsCache.list(characterId)
      } catch {
        return reply.code(503).send({ error: 'Status effects store unavailable' })
      }

      return reply.code(200).send({ characterId, effects })
    },
  )

  // ── POST /api/v1/status-effects/character/:characterId ────────────────────
  fastify.post<{ Params: { characterId: string } }>(
    '/api/v1/status-effects/character/:characterId',
    async (req, reply) => {
      const paramResult = validate(statusEffectCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const bodyResult = validate(applyStatusEffectSchema, req.body)
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: bodyResult.errors })
      }
      const { characterId } = paramResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      const { type, severity, source, reason, durationSeconds, metadata } = bodyResult.data
      const now = new Date().toISOString()
      const expiresAt = durationSeconds
        ? new Date(Date.now() + durationSeconds * 1000).toISOString()
        : null

      const effect: AtcStatusEffect = {
        id: `status:${characterId}:${type}`,
        characterId,
        type,
        severity,
        source,
        reason,
        startedAt: now,
        expiresAt,
        ...(metadata !== undefined ? { metadata } : {}),
      }

      try {
        await statusEffectsCache.apply(characterId, effect)
      } catch {
        return reply.code(503).send({ error: 'Status effects store unavailable' })
      }

      logger.info({ characterId, type, severity, source }, 'status effect applied')

      eventBus.emit(STATUS_CHANGED_EVENT, {
        characterId,
        type,
        action: 'applied',
        effect,
        timestamp: now,
      }).catch((err: unknown) => {
        logger.warn({ err, characterId }, 'status changed event emit failed')
      })

      return reply.code(200).send(effect)
    },
  )

  // ── DELETE /api/v1/status-effects/character/:characterId/:type ───────────
  fastify.delete<{ Params: { characterId: string; type: string } }>(
    '/api/v1/status-effects/character/:characterId/:type',
    async (req, reply) => {
      const paramResult = validate(statusEffectTypeParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const { characterId, type } = paramResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      try {
        await statusEffectsCache.clear(characterId, type)
      } catch {
        return reply.code(503).send({ error: 'Status effects store unavailable' })
      }

      logger.info({ characterId, type }, 'status effect cleared')

      eventBus.emit(STATUS_CHANGED_EVENT, {
        characterId,
        type: type as AtcStatusEffectType,
        action: 'cleared',
        timestamp: new Date().toISOString(),
      }).catch((err: unknown) => {
        logger.warn({ err, characterId }, 'status changed event emit failed')
      })

      return reply.code(204).send()
    },
  )

  // ── DELETE /api/v1/status-effects/character/:characterId ─────────────────
  fastify.delete<{ Params: { characterId: string } }>(
    '/api/v1/status-effects/character/:characterId',
    async (req, reply) => {
      const paramResult = validate(statusEffectCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const { characterId } = paramResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      try {
        await statusEffectsCache.clearAll(characterId)
      } catch {
        return reply.code(503).send({ error: 'Status effects store unavailable' })
      }

      logger.info({ characterId }, 'all status effects cleared')

      eventBus.emit(STATUS_CHANGED_EVENT, {
        characterId,
        action: 'cleared_all',
        timestamp: new Date().toISOString(),
      }).catch((err: unknown) => {
        logger.warn({ err, characterId }, 'status changed event emit failed')
      })

      return reply.code(204).send()
    },
  )
}
