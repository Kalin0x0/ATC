import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  bankTransferSchema,
  createListingSchema,
  purchaseListingSchema,
  createAuctionSchema,
  placeBidSchema,
  freezeAccountSchema,
  settleAuctionSchema,
} from '@atc/operations'
import {
  MarketError,
} from '@atc/market-runtime'

function marketErrorToStatus(err: MarketError): number {
  const name = err.constructor.name
  if (name === 'DuplicateTransactionError' || name === 'ListingAlreadySoldError') return 409
  if (name === 'BankAccountFrozenError' || name === 'InsufficientFundsError' || name === 'NegativeBalanceError' || name === 'ListingExpiredError' || name === 'AuctionEndedError' || name === 'AuctionBidTooLowError') return 422
  if (name.endsWith('NotFoundError')) return 404
  return 500
}

const NOT_CONFIGURED = { error: 'Market runtime not configured' }

export async function marketRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
): Promise<void> {
  const { ctx } = opts

  // ── Bank transfer ─────────────────────────────────────────────────────────────

  fastify.post('/api/v1/market/bank/transfer', {
    preHandler: requireCapability(ctx, 'market:bank:transfer'),
    handler: async (req, reply) => {
      if (!ctx.bankingRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = bankTransferSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const transactionId = await ctx.bankingRuntimeService.transfer(
          parsed.data.fromPrincipalId,
          parsed.data.toPrincipalId,
          BigInt(parsed.data.amount),
          parsed.data.idempotencyKey,
          parsed.data.description ?? null,
          parsed.data.metadata ?? null,
        )
        return reply.send({ transactionId })
      } catch (err) {
        if (err instanceof MarketError) return reply.status(marketErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get bank account ──────────────────────────────────────────────────────────

  fastify.get('/api/v1/market/bank/accounts/:principalId', {
    preHandler: requireCapability(ctx, 'market:bank:read'),
    handler: async (req, reply) => {
      if (!ctx.bankAccountRepo) return reply.status(503).send(NOT_CONFIGURED)
      const { principalId } = req.params as { principalId: string }
      const account = await ctx.bankAccountRepo.findByPrincipal(principalId)
      if (!account) return reply.status(404).send({ error: 'BankAccountNotFound' })
      return reply.send(account)
    },
  })

  // ── Freeze account ────────────────────────────────────────────────────────────

  fastify.post('/api/v1/market/bank/accounts/freeze', {
    preHandler: requireCapability(ctx, 'market:bank:freeze'),
    handler: async (req, reply) => {
      if (!ctx.bankingRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = freezeAccountSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        await ctx.bankingRuntimeService.freeze(parsed.data.principalId, parsed.data.frozenByPrincipalId, parsed.data.reason)
        return reply.status(204).send()
      } catch (err) {
        if (err instanceof MarketError) return reply.status(marketErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Create market listing ─────────────────────────────────────────────────────

  fastify.post('/api/v1/market/listings', {
    preHandler: requireCapability(ctx, 'market:listing:write'),
    handler: async (req, reply) => {
      if (!ctx.marketplaceService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = createListingSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.marketplaceService.createListing({
          sellerPrincipalId: parsed.data.sellerPrincipalId,
          itemName:          parsed.data.itemName,
          quantity:          parsed.data.quantity,
          pricePerUnit:      BigInt(parsed.data.pricePerUnit),
          listingNonce:      parsed.data.listingNonce,
          expiresAt:         new Date(Date.now() + parsed.data.expiresInHours * 3600 * 1000),
          ...(parsed.data.itemCategory != null ? { itemCategory: parsed.data.itemCategory } : {}),
          ...(parsed.data.description  != null ? { description:  parsed.data.description  } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof MarketError) return reply.status(marketErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Purchase listing ──────────────────────────────────────────────────────────

  fastify.post('/api/v1/market/listings/:listingId/purchase', {
    preHandler: requireCapability(ctx, 'market:listing:purchase'),
    handler: async (req, reply) => {
      if (!ctx.marketplaceService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = purchaseListingSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.marketplaceService.purchaseListing(
          parsed.data.listingId,
          parsed.data.buyerPrincipalId,
          parsed.data.idempotencyKey,
        )
        return reply.send(result)
      } catch (err) {
        if (err instanceof MarketError) return reply.status(marketErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get listing ───────────────────────────────────────────────────────────────

  fastify.get('/api/v1/market/listings/:listingId', {
    preHandler: requireCapability(ctx, 'market:listing:read'),
    handler: async (req, reply) => {
      if (!ctx.marketListingRepo) return reply.status(503).send(NOT_CONFIGURED)
      const { listingId } = req.params as { listingId: string }
      const listing = await ctx.marketListingRepo.findById(listingId)
      if (!listing) return reply.status(404).send({ error: 'ListingNotFound' })
      return reply.send(listing)
    },
  })

  // ── Create auction ────────────────────────────────────────────────────────────

  fastify.post('/api/v1/market/auctions', {
    preHandler: requireCapability(ctx, 'market:auction:write'),
    handler: async (req, reply) => {
      if (!ctx.auctionRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = createAuctionSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.auctionRuntimeService.createAuction({
          sellerPrincipalId:   parsed.data.sellerPrincipalId,
          itemName:            parsed.data.itemName,
          quantity:            parsed.data.quantity,
          startingBid:         BigInt(parsed.data.startingBid),
          minimumBidIncrement: BigInt(parsed.data.minimumBidIncrement),
          auctionNonce:        parsed.data.auctionNonce,
          endsAt:              new Date(Date.now() + parsed.data.durationHours * 3600 * 1000),
          ...(parsed.data.itemCategory != null ? { itemCategory: parsed.data.itemCategory } : {}),
          ...(parsed.data.reservePrice != null ? { reservePrice: BigInt(parsed.data.reservePrice) } : {}),
        })
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof MarketError) return reply.status(marketErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Place bid ─────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/market/auctions/:auctionId/bid', {
    preHandler: requireCapability(ctx, 'market:auction:bid'),
    handler: async (req, reply) => {
      if (!ctx.auctionRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = placeBidSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.auctionRuntimeService.placeBid(
          parsed.data.auctionId,
          parsed.data.bidderPrincipalId,
          BigInt(parsed.data.bidAmount),
          `${parsed.data.auctionId}:${parsed.data.bidderPrincipalId}:${parsed.data.bidAmount}`,
        )
        return reply.send(result)
      } catch (err) {
        if (err instanceof MarketError) return reply.status(marketErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Settle auction ────────────────────────────────────────────────────────────

  fastify.post('/api/v1/market/auctions/:auctionId/settle', {
    preHandler: requireCapability(ctx, 'market:auction:settle'),
    handler: async (req, reply) => {
      if (!ctx.auctionRuntimeService) return reply.status(503).send(NOT_CONFIGURED)
      const parsed = settleAuctionSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Validation', details: parsed.error.issues })
      try {
        const result = await ctx.auctionRuntimeService.settleAuction(parsed.data.auctionId)
        return reply.send(result)
      } catch (err) {
        if (err instanceof MarketError) return reply.status(marketErrorToStatus(err)).send({ error: err.constructor.name, message: err.message })
        throw err
      }
    },
  })

  // ── Get auction ───────────────────────────────────────────────────────────────

  fastify.get('/api/v1/market/auctions/:auctionId', {
    preHandler: requireCapability(ctx, 'market:auction:read'),
    handler: async (req, reply) => {
      if (!ctx.marketAuctionRepo) return reply.status(503).send(NOT_CONFIGURED)
      const { auctionId } = req.params as { auctionId: string }
      const auction = await ctx.marketAuctionRepo.findById(auctionId)
      if (!auction) return reply.status(404).send({ error: 'AuctionNotFound' })
      return reply.send(auction)
    },
  })

  // ── List financial flags ──────────────────────────────────────────────────────

  fastify.get('/api/v1/market/fraud/flags', {
    preHandler: requireCapability(ctx, 'market:fraud:read'),
    handler: async (req, reply) => {
      if (!ctx.financialFlagRepo) return reply.status(503).send(NOT_CONFIGURED)
      const query = req.query as { severity?: string }
      const flags = query.severity
        ? await ctx.financialFlagRepo.listBySeverity(query.severity as never)
        : await ctx.financialFlagRepo.listAllUnresolved()
      return reply.send(flags)
    },
  })
}
