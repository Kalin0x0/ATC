import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import type { AppContext } from '../context.js'
import { validate } from '@atc/schemas'
import {
  walletCreditSchema,
  walletDebitSchema,
  walletTransferSchema,
  walletCharacterParamSchema,
  walletTransactionQuerySchema,
  currencySchema,
} from '@atc/schemas'
import {
  WalletFrozenError,
  WalletClosedError,
  InsufficientFundsError,
  IdempotencyPayloadMismatchError,
} from '@atc/db'

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

export const walletRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (fastify, { ctx }) => {
  const { wallets, logger } = ctx

  // ── GET /api/v1/wallets/character/:characterId ────────────────────────────
  fastify.get<{ Params: { characterId: string }; Querystring: { currency?: string } }>(
    '/api/v1/wallets/character/:characterId',
    async (req, reply) => {
      const paramResult = validate(walletCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const currencyResult = validate(currencySchema, req.query.currency ?? 'ATC')
      if (!currencyResult.success) {
        return reply.code(400).send({ error: 'Invalid currency' })
      }

      const { characterId } = paramResult.data
      const currency = currencyResult.data

      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      const wallet = await wallets.getOrCreate(characterId, currency)
      return reply.code(200).send({
        characterId: wallet.characterId,
        currency: wallet.currency,
        cashBalance: wallet.cashBalance,
        bankBalance: wallet.bankBalance,
        status: wallet.status,
      })
    },
  )

  // ── POST /api/v1/wallets/character/:characterId/credit ────────────────────
  fastify.post<{ Params: { characterId: string } }>(
    '/api/v1/wallets/character/:characterId/credit',
    async (req, reply) => {
      const paramResult = validate(walletCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const bodyResult = validate(walletCreditSchema, req.body)
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: bodyResult.errors })
      }

      const { characterId } = paramResult.data
      const { account, amount, currency, reason, source, idempotencyKey, metadata } = bodyResult.data

      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      try {
        const result = await wallets.credit({
          characterId,
          currency,
          account,
          amount,
          reason,
          source,
          idempotencyKey,
          ...(metadata !== undefined ? { metadata } : {}),
        })

        const statusCode = result.idempotent ? 200 : 201
        return reply.code(statusCode).send({
          transactionId: result.transactionId,
          walletId: result.walletId,
          characterId,
          currency,
          cashBalance: result.cashBalance,
          bankBalance: result.bankBalance,
          amount: result.amount,
          type: result.type,
          account: result.account,
          idempotent: result.idempotent,
        })
      } catch (err) {
        if (err instanceof IdempotencyPayloadMismatchError) {
          return reply.code(409).send({ error: 'Idempotency key reused with a different payload' })
        }
        if (err instanceof WalletFrozenError) {
          return reply.code(422).send({ error: 'Wallet is frozen' })
        }
        if (err instanceof WalletClosedError) {
          return reply.code(422).send({ error: 'Wallet is closed' })
        }
        logger.error({ err, characterId }, 'wallet credit error')
        return reply.code(500).send({ error: 'Internal server error' })
      }
    },
  )

  // ── POST /api/v1/wallets/character/:characterId/debit ─────────────────────
  fastify.post<{ Params: { characterId: string } }>(
    '/api/v1/wallets/character/:characterId/debit',
    async (req, reply) => {
      const paramResult = validate(walletCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const bodyResult = validate(walletDebitSchema, req.body)
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: bodyResult.errors })
      }

      const { characterId } = paramResult.data
      const { account, amount, currency, reason, source, idempotencyKey, metadata } = bodyResult.data

      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      try {
        const result = await wallets.debit({
          characterId,
          currency,
          account,
          amount,
          reason,
          source,
          idempotencyKey,
          ...(metadata !== undefined ? { metadata } : {}),
        })

        const statusCode = result.idempotent ? 200 : 201
        return reply.code(statusCode).send({
          transactionId: result.transactionId,
          walletId: result.walletId,
          characterId,
          currency,
          cashBalance: result.cashBalance,
          bankBalance: result.bankBalance,
          amount: result.amount,
          type: result.type,
          account: result.account,
          idempotent: result.idempotent,
        })
      } catch (err) {
        if (err instanceof IdempotencyPayloadMismatchError) {
          return reply.code(409).send({ error: 'Idempotency key reused with a different payload' })
        }
        if (err instanceof InsufficientFundsError) {
          return reply.code(422).send({ error: 'Insufficient funds' })
        }
        if (err instanceof WalletFrozenError) {
          return reply.code(422).send({ error: 'Wallet is frozen' })
        }
        if (err instanceof WalletClosedError) {
          return reply.code(422).send({ error: 'Wallet is closed' })
        }
        logger.error({ err, characterId }, 'wallet debit error')
        return reply.code(500).send({ error: 'Internal server error' })
      }
    },
  )

  // ── POST /api/v1/wallets/character/:characterId/transfer ──────────────────
  fastify.post<{ Params: { characterId: string } }>(
    '/api/v1/wallets/character/:characterId/transfer',
    async (req, reply) => {
      const paramResult = validate(walletCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const bodyResult = validate(walletTransferSchema, req.body)
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: bodyResult.errors })
      }

      const { characterId } = paramResult.data
      const { fromAccount, toAccount, amount, currency, reason, idempotencyKey, metadata } = bodyResult.data

      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      try {
        const result = await wallets.transfer({
          characterId,
          currency,
          fromAccount,
          toAccount,
          amount,
          reason,
          idempotencyKey,
          ...(metadata !== undefined ? { metadata } : {}),
        })

        const statusCode = result.idempotent ? 200 : 201
        return reply.code(statusCode).send({
          transactionId: result.transactionId,
          walletId: result.walletId,
          characterId,
          currency,
          cashBalance: result.cashBalance,
          bankBalance: result.bankBalance,
          amount: result.amount,
          type: result.type,
          account: result.account,
          idempotent: result.idempotent,
        })
      } catch (err) {
        if (err instanceof IdempotencyPayloadMismatchError) {
          return reply.code(409).send({ error: 'Idempotency key reused with a different payload' })
        }
        if (err instanceof InsufficientFundsError) {
          return reply.code(422).send({ error: 'Insufficient funds' })
        }
        if (err instanceof WalletFrozenError) {
          return reply.code(422).send({ error: 'Wallet is frozen' })
        }
        if (err instanceof WalletClosedError) {
          return reply.code(422).send({ error: 'Wallet is closed' })
        }
        logger.error({ err, characterId }, 'wallet transfer error')
        return reply.code(500).send({ error: 'Internal server error' })
      }
    },
  )

  // ── GET /api/v1/wallets/character/:characterId/transactions ───────────────
  fastify.get<{ Params: { characterId: string }; Querystring: Record<string, string> }>(
    '/api/v1/wallets/character/:characterId/transactions',
    async (req, reply) => {
      const paramResult = validate(walletCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const queryResult = validate(walletTransactionQuerySchema, req.query)
      if (!queryResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: queryResult.errors })
      }

      const { characterId } = paramResult.data
      const { currency, limit, offset } = queryResult.data

      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      const { transactions, total } = await wallets.listTransactions(characterId, currency, limit, offset)

      return reply.code(200).send({
        transactions: transactions.map((tx) => ({
          id: tx.id,
          walletId: tx.walletId,
          characterId: tx.characterId,
          type: tx.type,
          account: tx.account,
          amount: tx.amount,
          balanceAfter: tx.balanceAfter,
          currency: tx.currency,
          reason: tx.reason,
          source: tx.source,
          idempotencyKey: tx.idempotencyKey,
          metadata: tx.metadata,
          createdAt: tx.createdAt,
        })),
        total,
      })
    },
  )
}
