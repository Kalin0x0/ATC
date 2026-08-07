import type { FastifyPluginAsync } from 'fastify'
import type { AppContext } from '../context.js'
import { validate } from '@atc/schemas'
import {
  accountUpsertRequestSchema,
  banCreateRequestSchema,
  banIdParamSchema,
  identifierParamSchema,
} from '@atc/schemas'
import { requirePermission } from '../middleware/authorization.js'
import type { AtcAccountStatus, AtcLocaleCode } from '@atc/shared-types'

export const accountRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (fastify, opts) => {
  const { accounts, bans, logger } = opts.ctx

  fastify.post('/api/v1/accounts', async (req, reply) => {
    const parsed = validate(accountUpsertRequestSchema, req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.errors })
    }

    const { primaryIdentifier, identifiers, preferredLanguage } = parsed.data

    const flatIdentifiers: Record<string, string> = {}
    if (identifiers.license) flatIdentifiers['license'] = identifiers.license
    if (identifiers.license2) flatIdentifiers['license2'] = identifiers.license2
    if (identifiers.discord) flatIdentifiers['discord'] = identifiers.discord
    if (identifiers.steam) flatIdentifiers['steam'] = identifiers.steam
    if (identifiers.fivem) flatIdentifiers['fivem'] = identifiers.fivem

    try {
      const result = await accounts.upsert({
        primaryIdentifier,
        identifiers: flatIdentifiers,
        preferredLanguage: preferredLanguage as AtcLocaleCode,
      })

      const hasBan = result.status !== 'active'
        ? false
        : await bans.hasActiveBan(result.id)

      const status: AtcAccountStatus = hasBan ? 'banned' : result.status

      logger.info({ accountId: result.id, created: result.created }, 'account upsert')

      return reply.code(result.created ? 201 : 200).send({
        accountId: result.id,
        status,
        preferredLanguage,
        created: result.created,
      })
    } catch (err) {
      logger.error({ err }, 'account upsert failed')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  fastify.get('/api/v1/accounts/check/:identifier', async (req, reply) => {
    const paramsParsed = validate(identifierParamSchema, req.params)
    if (!paramsParsed.success) {
      return reply.code(400).send({ error: 'Invalid identifier' })
    }

    const { identifier } = paramsParsed.data

    try {
      const account = await accounts.findByIdentifier(identifier)

      if (!account) {
        return reply.code(200).send({
          allowed: true,
          status: 'active' as AtcAccountStatus,
          reason: null,
          accountId: null,
        })
      }

      if (account.status !== 'active') {
        const ban = await bans.findActiveByAccountId(account.id)
        return reply.code(200).send({
          allowed: false,
          status: account.status,
          reason: ban?.reason ?? 'Account suspended',
          accountId: account.id,
        })
      }

      const ban = await bans.findActiveByAccountId(account.id)
      if (ban) {
        return reply.code(200).send({
          allowed: false,
          status: 'banned' as AtcAccountStatus,
          reason: ban.reason,
          accountId: account.id,
        })
      }

      return reply.code(200).send({
        allowed: true,
        status: 'active' as AtcAccountStatus,
        reason: null,
        accountId: account.id,
      })
    } catch (err) {
      logger.error({ err, identifier }, 'ban check failed')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ── Bans ────────────────────────────────────────────────────────────────────
  // Until now bans could only be read: GET /accounts/check/:identifier answered
  // from atc_bans, but nothing wrote to it. The game server's auto-ban and the
  // /atcban admin command both posted here and got a 404, so a "ban" was a kick
  // and the player could reconnect at once.

  fastify.post('/api/v1/accounts/ban', {
    preHandler: requirePermission(opts.ctx, 'player.ban'),
  }, async (req, reply) => {
    const parsed = validate(banCreateRequestSchema, req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.errors })
    }

    const { accountId, identifier, reason, expiresAt, bannedByPrincipalId } = parsed.data

    try {
      // The caller may name the account either way; identifier is what a game
      // server has in hand at the moment it decides to ban.
      let resolvedId = accountId
      if (resolvedId === undefined) {
        const account = await accounts.findByIdentifier(identifier as string)
        if (!account) {
          return reply.code(404).send({ error: 'Account not found', identifier })
        }
        resolvedId = account.id
      } else {
        // An unknown id would otherwise fail on the foreign key as a 500.
        const status = await accounts.getStatusById(resolvedId)
        if (status === null) {
          return reply.code(404).send({ error: 'Account not found', accountId: resolvedId })
        }
      }

      const ban = await bans.create({
        accountId: resolvedId,
        reason,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        bannedBy: bannedByPrincipalId ?? null,
      })

      logger.warn(
        { accountId: ban.accountId, banId: ban.id, expiresAt: ban.expiresAt, reason },
        'account banned',
      )

      return reply.code(201).send({
        id: ban.id,
        accountId: ban.accountId,
        reason: ban.reason,
        expiresAt: ban.expiresAt?.toISOString() ?? null,
        createdAt: ban.createdAt.toISOString(),
      })
    } catch (err) {
      logger.error({ err, accountId, identifier }, 'ban create failed')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  fastify.delete('/api/v1/accounts/ban/:banId', {
    preHandler: requirePermission(opts.ctx, 'player.ban'),
  }, async (req, reply) => {
    const parsed = validate(banIdParamSchema, req.params)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid ban id' })
    }

    try {
      const revoked = await bans.revoke(parsed.data.banId)
      if (!revoked) {
        // Either unknown or already lifted — both mean there is nothing to do,
        // and distinguishing them would leak whether a ban id exists.
        return reply.code(404).send({ error: 'No active ban with that id' })
      }
      logger.warn({ banId: parsed.data.banId }, 'ban revoked')
      return reply.code(200).send({ revoked: true, banId: parsed.data.banId })
    } catch (err) {
      logger.error({ err, banId: parsed.data.banId }, 'ban revoke failed')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  fastify.get('/api/v1/accounts/:accountId/bans', {
    preHandler: requirePermission(opts.ctx, 'player.ban'),
  }, async (req, reply) => {
    const { accountId } = req.params as { accountId: string }

    try {
      const history = await bans.listByAccountId(accountId)
      return reply.code(200).send({
        accountId,
        bans: history.map((b) => ({
          id: b.id,
          accountId: b.accountId,
          reason: b.reason,
          expiresAt: b.expiresAt?.toISOString() ?? null,
          createdAt: b.createdAt.toISOString(),
        })),
        total: history.length,
      })
    } catch (err) {
      logger.error({ err, accountId }, 'ban list failed')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
