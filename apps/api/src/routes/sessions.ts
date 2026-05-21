import type { FastifyPluginAsync } from 'fastify'
import type { AppContext } from '../context.js'
import { validate } from '@atc/schemas'
import { sessionCreateRequestSchema, sourceParamSchema } from '@atc/schemas'
import type { AtcLocaleCode } from '@atc/shared-types'

export const sessionRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (fastify, opts) => {
  const { sessions, sessionCache, logger } = opts.ctx

  fastify.post('/api/v1/sessions', async (req, reply) => {
    const parsed = validate(sessionCreateRequestSchema, req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.errors })
    }

    const { accountId, source, name, primaryIdentifier, language } = parsed.data

    try {
      // End any prior active session for this source before creating a new one.
      // Handles unclean disconnects where playerDropped may not have fired.
      const prevEnded = await sessions.endBySource(source)
      if (prevEnded) {
        await sessionCache.del(source).catch(() => undefined)
        logger.warn({ source }, 'ended stale session before new connect')
      }

      const session = await sessions.create({
        accountId,
        source,
        name,
        primaryIdentifier,
        language: language as AtcLocaleCode,
      })

      // Redis write is best-effort — DB is the source of truth.
      // If Redis is down, GET /sessions/source/:source falls back to DB.
      try {
        await sessionCache.set({
          sessionId: session.id,
          accountId: session.accountId,
          source: session.source,
          language: session.language,
          state: 'connecting',
          characterId: null,
        })
      } catch (cacheErr) {
        logger.warn({ cacheErr, source }, 'session cache write failed — continuing without cache')
      }

      logger.info({ sessionId: session.id, source, accountId }, 'session created')

      return reply.code(201).send({
        sessionId: session.id,
        accountId: session.accountId,
        source: session.source,
        language: session.language,
        state: session.state,
      })
    } catch (err) {
      logger.error({ err, source }, 'session create failed')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  fastify.delete('/api/v1/sessions/:source', async (req, reply) => {
    const paramsParsed = validate(sourceParamSchema, req.params)
    if (!paramsParsed.success) {
      return reply.code(400).send({ error: 'Invalid source' })
    }

    const { source } = paramsParsed.data

    try {
      const ended = await sessions.endBySource(source)
      // Redis delete is best-effort — failure here must not fail the response
      await sessionCache.del(source).catch((cacheErr: unknown) => {
        logger.warn({ cacheErr, source }, 'session cache delete failed')
      })

      logger.info({ source, ended }, 'session ended')

      return reply.code(204).send()
    } catch (err) {
      logger.error({ err, source }, 'session end failed')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  fastify.get('/api/v1/sessions/source/:source', async (req, reply) => {
    const paramsParsed = validate(sourceParamSchema, req.params)
    if (!paramsParsed.success) {
      return reply.code(400).send({ error: 'Invalid source' })
    }

    const { source } = paramsParsed.data

    try {
      const cached = await sessionCache.get(source)
      if (cached && cached.state !== 'ended') {
        await sessionCache.refresh(source).catch(() => undefined)
        return reply.code(200).send(cached)
      }
      // If cache held a stale ended entry, evict it
      if (cached?.state === 'ended') {
        await sessionCache.del(source).catch(() => undefined)
      }

      const session = await sessions.findBySource(source)
      if (!session) {
        return reply.code(404).send({ error: 'Session not found' })
      }

      await sessionCache.set({
        sessionId: session.id,
        accountId: session.accountId,
        source: session.source,
        language: session.language,
        state: session.state,
        characterId: session.characterId ?? null,
      })

      return reply.code(200).send({
        sessionId: session.id,
        accountId: session.accountId,
        source: session.source,
        language: session.language,
        state: session.state,
        characterId: session.characterId ?? null,
      })
    } catch (err) {
      logger.error({ err, source }, 'session lookup failed')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
