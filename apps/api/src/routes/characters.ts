import type { FastifyPluginAsync } from 'fastify'
import type { AppContext } from '../context.js'
import { validate } from '@atc/schemas'
import {
  characterCreateSchema,
  characterSelectSchema,
  characterIdParamSchema,
  accountIdParamSchema,
  sessionIdParamSchema,
} from '@atc/schemas'
import { CharacterLimitError, CharacterSlotTakenError } from '@atc/db'

export const characterRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (fastify, opts) => {
  const { accounts, characters, sessions, sessionCache, vitals, logger } = opts.ctx

  // POST /api/v1/characters — create a new character
  fastify.post('/api/v1/characters', async (req, reply) => {
    const parsed = validate(characterCreateSchema, req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.errors })
    }

    const { accountId, slot, firstName, lastName, gender, dateOfBirth, nationality, metadata } = parsed.data

    try {
      // Banned and suspended accounts must not create characters.
      const accountStatus = await accounts.getStatusById(accountId)
      if (!accountStatus) {
        return reply.code(404).send({ error: 'Account not found' })
      }
      if (accountStatus !== 'active') {
        return reply.code(403).send({ error: 'Account is not active' })
      }

      const character = await characters.create({
        accountId,
        slot,
        firstName,
        lastName,
        gender,
        ...(dateOfBirth !== undefined ? { dateOfBirth } : {}),
        ...(nationality !== undefined ? { nationality } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
      })

      logger.info({ characterId: character.id, accountId, slot }, 'character created')

      // Eagerly create the vitals row so first access is a cache hit, not a lazy INSERT.
      // Best-effort — the 201 response is not delayed; getOrCreate is race-safe if this fails.
      vitals.getOrCreate(character.id).catch((err: unknown) => {
        logger.warn({ err, characterId: character.id }, 'eager vitals create failed — will lazy-create on first access')
      })

      return reply.code(201).send({
        characterId: character.id,
        slot: character.slot,
        firstName: character.firstName,
        lastName: character.lastName,
        status: character.status,
        created: true,
      })
    } catch (err) {
      if (err instanceof CharacterLimitError) {
        return reply.code(422).send({ error: 'Character limit reached' })
      }
      if (err instanceof CharacterSlotTakenError) {
        return reply.code(409).send({ error: 'Character slot already in use' })
      }
      logger.error({ err, accountId, slot }, 'character create failed')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // GET /api/v1/characters/account/:accountId — list active characters for account
  fastify.get('/api/v1/characters/account/:accountId', async (req, reply) => {
    const paramsParsed = validate(accountIdParamSchema, req.params)
    if (!paramsParsed.success) {
      return reply.code(400).send({ error: 'Invalid accountId' })
    }

    const { accountId } = paramsParsed.data

    try {
      const list = await characters.listByAccount(accountId, 'active')

      return reply.code(200).send({
        characters: list.map((c) => ({
          characterId: c.id,
          slot: c.slot,
          firstName: c.firstName,
          lastName: c.lastName,
          status: c.status,
          dateOfBirth: c.dateOfBirth,
          gender: c.gender,
          nationality: c.nationality,
        })),
      })
    } catch (err) {
      logger.error({ err, accountId }, 'character list failed')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // GET /api/v1/characters/:characterId — fetch one character
  fastify.get('/api/v1/characters/:characterId', async (req, reply) => {
    const paramsParsed = validate(characterIdParamSchema, req.params)
    if (!paramsParsed.success) {
      return reply.code(400).send({ error: 'Invalid characterId' })
    }

    const { characterId } = paramsParsed.data

    try {
      const character = await characters.findById(characterId)
      if (!character) {
        return reply.code(404).send({ error: 'Character not found' })
      }

      return reply.code(200).send({
        characterId: character.id,
        accountId: character.accountId,
        slot: character.slot,
        firstName: character.firstName,
        lastName: character.lastName,
        gender: character.gender,
        dateOfBirth: character.dateOfBirth,
        nationality: character.nationality,
        metadata: character.metadata,
        status: character.status,
        createdAt: character.createdAt,
        updatedAt: character.updatedAt,
      })
    } catch (err) {
      logger.error({ err, characterId }, 'character fetch failed')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // PATCH /api/v1/sessions/:sessionId/character — attach character to session
  fastify.patch('/api/v1/sessions/:sessionId/character', async (req, reply) => {
    const paramsParsed = validate(sessionIdParamSchema, req.params)
    if (!paramsParsed.success) {
      return reply.code(400).send({ error: 'Invalid sessionId' })
    }

    const bodyParsed = validate(characterSelectSchema, req.body)
    if (!bodyParsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: bodyParsed.errors })
    }

    const { sessionId } = paramsParsed.data
    const { characterId } = bodyParsed.data

    try {
      // Load session — must exist and not be ended
      const session = await sessions.findById(sessionId)
      if (!session) {
        return reply.code(404).send({ error: 'Session not found' })
      }
      if (session.state === 'ended') {
        return reply.code(409).send({ error: 'Session has ended' })
      }

      // Verify character ownership and that it is active.
      // Querying by (characterId, session.accountId) prevents cross-account selection.
      const character = await characters.findOwnedByAccount(characterId, session.accountId)
      if (!character) {
        return reply.code(403).send({ error: 'Character not found or not owned by this account' })
      }
      if (character.status !== 'active') {
        return reply.code(422).send({ error: 'Character is not active' })
      }

      // Persist the association. Returns false if the session ended concurrently.
      const attached = await sessions.attachCharacter(sessionId, characterId)
      if (!attached) {
        return reply.code(409).send({ error: 'Session ended before character could be attached' })
      }

      // Best-effort: update Redis cache with the new characterId
      try {
        const cached = await sessionCache.get(session.source)
        if (cached) {
          await sessionCache.set({ ...cached, characterId })
        }
      } catch (cacheErr) {
        logger.warn({ cacheErr, sessionId, characterId }, 'session cache update failed after character select')
      }

      logger.info({ sessionId, characterId, accountId: session.accountId }, 'character selected')

      return reply.code(200).send({
        sessionId,
        characterId,
        accountId: session.accountId,
        firstName: character.firstName,
        lastName: character.lastName,
        status: character.status,
      })
    } catch (err) {
      logger.error({ err, sessionId, characterId }, 'character select failed')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
