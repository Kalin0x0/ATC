import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  createShopSchema,
  updateShopStatusSchema,
  upsertShopItemSchema,
  purchaseSchema,
  sellSchema,
  listOrdersQuerySchema,
  listReceiptsQuerySchema,
  createTaxRuleSchema,
  listShopsQuerySchema,
} from '@atc/operations'
import {
  CommerceError,
  CommerceValidationError,
  CommerceShopNotFoundError,
  CommerceShopNotActiveError,
  CommerceShopItemNotFoundError,
  CommerceInsufficientStockError,
  CommerceShopCannotBuyError,
  CommerceCurrencyMismatchError,
  CommerceInsufficientInventoryError,
  CommerceInventoryFullError,
  CommerceOrderNotFoundError,
  CommerceReceiptNotFoundError,
  CommerceShopMisconfiguredError,
} from '@atc/commerce'


function commerceErrorToResponse(err: CommerceError): { status: number; error: string; message: string } {
  if (err instanceof CommerceValidationError)         return { status: 400, error: 'CommerceValidation',     message: err.message }
  if (err instanceof CommerceCurrencyMismatchError)   return { status: 400, error: 'CurrencyMismatch',       message: err.message }
  if (err instanceof CommerceShopNotFoundError)       return { status: 404, error: 'ShopNotFound',           message: err.message }
  if (err instanceof CommerceShopItemNotFoundError)   return { status: 404, error: 'ShopItemNotFound',       message: err.message }
  if (err instanceof CommerceOrderNotFoundError)      return { status: 404, error: 'OrderNotFound',          message: err.message }
  if (err instanceof CommerceReceiptNotFoundError)    return { status: 404, error: 'ReceiptNotFound',        message: err.message }
  if (err instanceof CommerceShopNotActiveError)      return { status: 422, error: 'ShopNotActive',          message: err.message }
  if (err instanceof CommerceInsufficientStockError)  return { status: 422, error: 'InsufficientStock',      message: err.message }
  if (err instanceof CommerceShopCannotBuyError)      return { status: 422, error: 'ShopCannotBuy',          message: err.message }
  if (err instanceof CommerceInsufficientInventoryError) return { status: 422, error: 'InsufficientInventory', message: err.message }
  if (err instanceof CommerceInventoryFullError)      return { status: 422, error: 'InventoryFull',          message: err.message }
  if (err instanceof CommerceShopMisconfiguredError)  return { status: 500, error: 'ShopMisconfigured',      message: err.message }
  return { status: 500, error: 'CommerceError', message: err.message }
}

const NOT_CONFIGURED = { error: 'Commerce not configured' }

export async function commerceRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
) {
  const { ctx } = opts

  // ── Shops ────────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/commerce/shops', {
    preHandler: requireCapability(ctx, 'commerce.write'),
  }, async (req, reply) => {
    if (!ctx.commerceShops) return reply.code(503).send(NOT_CONFIGURED)
    const result = createShopSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    const shop = await ctx.commerceShops.create(result.data)
    return reply.code(201).send(shop)
  })

  fastify.get('/api/v1/commerce/shops', {
    preHandler: requireCapability(ctx, 'commerce.read'),
  }, async (req, reply) => {
    if (!ctx.commerceShops) return reply.code(503).send(NOT_CONFIGURED)
    const result = listShopsQuerySchema.safeParse(req.query)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    const { type, status, ownerOrgId, limit, offset } = result.data
    const page = await ctx.commerceShops.list({ type, status, ownerOrgId, limit, offset })
    return reply.send(page)
  })

  fastify.get('/api/v1/commerce/shops/:shopId', {
    preHandler: requireCapability(ctx, 'commerce.read'),
  }, async (req, reply) => {
    if (!ctx.commerceShops) return reply.code(503).send(NOT_CONFIGURED)
    const { shopId } = req.params as { shopId: string }
    const shop = await ctx.commerceShops.findById(shopId)
    if (!shop) return reply.code(404).send({ error: 'Shop not found' })
    return reply.send(shop)
  })

  fastify.patch('/api/v1/commerce/shops/:shopId/status', {
    preHandler: requireCapability(ctx, 'commerce.write'),
  }, async (req, reply) => {
    if (!ctx.commerceShops) return reply.code(503).send(NOT_CONFIGURED)
    const { shopId } = req.params as { shopId: string }
    const result = updateShopStatusSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    const shop = await ctx.commerceShops.updateStatus(shopId, result.data.status)
    if (!shop) return reply.code(404).send({ error: 'Shop not found' })
    return reply.send(shop)
  })

  // ── Shop Items ────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/commerce/shops/:shopId/items', {
    preHandler: requireCapability(ctx, 'commerce.read'),
  }, async (req, reply) => {
    if (!ctx.commerceShopItems) return reply.code(503).send(NOT_CONFIGURED)
    const { shopId } = req.params as { shopId: string }
    const items = await ctx.commerceShopItems.listByShop(shopId)
    return reply.send({ items, total: items.length })
  })

  fastify.put('/api/v1/commerce/shops/:shopId/items/:itemId', {
    preHandler: requireCapability(ctx, 'commerce.write'),
  }, async (req, reply) => {
    if (!ctx.commerceShopItems) return reply.code(503).send(NOT_CONFIGURED)
    const { shopId, itemId } = req.params as { shopId: string; itemId: string }
    const result = upsertShopItemSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    const item = await ctx.commerceShopItems.upsert({ ...result.data, shopId, itemId })
    return reply.send(item)
  })

  fastify.delete('/api/v1/commerce/shops/:shopId/items/:itemId', {
    preHandler: requireCapability(ctx, 'commerce.write'),
  }, async (req, reply) => {
    if (!ctx.commerceShopItems) return reply.code(503).send(NOT_CONFIGURED)
    const { shopId, itemId } = req.params as { shopId: string; itemId: string }
    const removed = await ctx.commerceShopItems.remove(shopId, itemId)
    if (!removed) return reply.code(404).send({ error: 'Shop item not found' })
    return reply.send({ ok: true })
  })

  // ── Transactions ──────────────────────────────────────────────────────────────

  fastify.post('/api/v1/commerce/purchase', {
    preHandler: requireCapability(ctx, 'commerce.write'),
  }, async (req, reply) => {
    if (!ctx.commerceService) return reply.code(503).send(NOT_CONFIGURED)
    const result = purchaseSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const tx = await ctx.commerceService.purchase(result.data)
      return reply.code(201).send(tx)
    } catch (err) {
      if (err instanceof CommerceError) {
        const r = commerceErrorToResponse(err)
        return reply.code(r.status).send({ error: r.error, message: r.message })
      }
      throw err
    }
  })

  fastify.post('/api/v1/commerce/sell', {
    preHandler: requireCapability(ctx, 'commerce.write'),
  }, async (req, reply) => {
    if (!ctx.commerceService) return reply.code(503).send(NOT_CONFIGURED)
    const result = sellSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    try {
      const tx = await ctx.commerceService.sell(result.data)
      return reply.code(201).send(tx)
    } catch (err) {
      if (err instanceof CommerceError) {
        const r = commerceErrorToResponse(err)
        return reply.code(r.status).send({ error: r.error, message: r.message })
      }
      throw err
    }
  })

  fastify.get('/api/v1/commerce/preview/purchase', {
    preHandler: requireCapability(ctx, 'commerce.read'),
  }, async (req, reply) => {
    if (!ctx.commerceService) return reply.code(503).send(NOT_CONFIGURED)
    const { shopId, itemId, quantity } = req.query as { shopId?: string; itemId?: string; quantity?: string }
    if (!shopId || !itemId || !quantity) {
      return reply.code(400).send({ error: 'shopId, itemId, and quantity are required' })
    }
    const qty = parseInt(quantity, 10)
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
      return reply.code(400).send({ error: 'quantity must be an integer 1-999' })
    }
    try {
      const totals = await ctx.commerceService.calculateTotals(shopId, itemId, qty, 'purchase')
      return reply.send(totals)
    } catch (err) {
      if (err instanceof CommerceError) {
        const r = commerceErrorToResponse(err)
        return reply.code(r.status).send({ error: r.error, message: r.message })
      }
      throw err
    }
  })

  // ── Orders ────────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/commerce/orders', {
    preHandler: requireCapability(ctx, 'commerce.read'),
  }, async (req, reply) => {
    if (!ctx.commerceOrders) return reply.code(503).send(NOT_CONFIGURED)
    const result = listOrdersQuerySchema.safeParse(req.query)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    const page = await ctx.commerceOrders.list(result.data)
    return reply.send(page)
  })

  fastify.get('/api/v1/commerce/orders/:orderId', {
    preHandler: requireCapability(ctx, 'commerce.read'),
  }, async (req, reply) => {
    if (!ctx.commerceOrders) return reply.code(503).send(NOT_CONFIGURED)
    const { orderId } = req.params as { orderId: string }
    const order = await ctx.commerceOrders.findById(orderId)
    if (!order) return reply.code(404).send({ error: 'Order not found' })
    return reply.send(order)
  })

  // ── Receipts ──────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/commerce/receipts', {
    preHandler: requireCapability(ctx, 'commerce.read'),
  }, async (req, reply) => {
    if (!ctx.commerceReceipts) return reply.code(503).send(NOT_CONFIGURED)
    const result = listReceiptsQuerySchema.safeParse(req.query)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    const page = await ctx.commerceReceipts.list(result.data)
    return reply.send(page)
  })

  fastify.get('/api/v1/commerce/receipts/:receiptId', {
    preHandler: requireCapability(ctx, 'commerce.read'),
  }, async (req, reply) => {
    if (!ctx.commerceReceipts) return reply.code(503).send(NOT_CONFIGURED)
    const { receiptId } = req.params as { receiptId: string }
    const receipt = await ctx.commerceReceipts.findById(receiptId)
    if (!receipt) return reply.code(404).send({ error: 'Receipt not found' })
    return reply.send(receipt)
  })

  // ── Tax Rules ─────────────────────────────────────────────────────────────────

  fastify.get('/api/v1/commerce/tax-rules', {
    preHandler: requireCapability(ctx, 'commerce.read'),
  }, async (req, reply) => {
    if (!ctx.commerceTaxRules) return reply.code(503).send(NOT_CONFIGURED)
    const rules = await ctx.commerceTaxRules.list()
    return reply.send({ items: rules, total: rules.length })
  })

  fastify.post('/api/v1/commerce/tax-rules', {
    preHandler: requireCapability(ctx, 'commerce.write'),
  }, async (req, reply) => {
    if (!ctx.commerceTaxRules) return reply.code(503).send(NOT_CONFIGURED)
    const result = createTaxRuleSchema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    const rule = await ctx.commerceTaxRules.create(result.data)
    return reply.code(201).send(rule)
  })

  fastify.patch('/api/v1/commerce/tax-rules/:ruleId/active', {
    preHandler: requireCapability(ctx, 'commerce.write'),
  }, async (req, reply) => {
    if (!ctx.commerceTaxRules) return reply.code(503).send(NOT_CONFIGURED)
    const { ruleId } = req.params as { ruleId: string }
    const body = req.body as { isActive?: unknown }
    if (typeof body?.isActive !== 'boolean') {
      return reply.code(400).send({ error: 'isActive (boolean) is required' })
    }
    const updated = await ctx.commerceTaxRules.setActive(ruleId, body.isActive)
    if (!updated) return reply.code(404).send({ error: 'Tax rule not found' })
    return reply.send({ ok: true })
  })
}
