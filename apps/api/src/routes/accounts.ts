import type { FastifyPluginAsync } from 'fastify'
import type { AppContext } from '../context.js'
import { validate } from '@atc/schemas'
import {
  accountUpsertRequestSchema,
  identifierParamSchema,
} from '@atc/schemas'
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
}
