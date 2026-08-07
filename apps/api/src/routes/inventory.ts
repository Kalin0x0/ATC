import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import type { AppContext } from '../context.js'
import { validate } from '@atc/schemas'
import {
  inventoryCharacterParamSchema,
  inventoryAddSchema,
  inventoryRemoveSchema,
  inventoryMoveSchema,
  inventoryTransactionQuerySchema,
  inventoryUpdateSettingsSchema,
  itemUseSchema,
  groundLootDropSchema,
  groundLootPickupSchema,
  groundLootIdParamSchema,
} from '@atc/schemas'
import {
  InventoryItemNotFoundError,
  InventorySlotOccupiedError,
  InventoryInsufficientQuantityError,
  InventoryFullError,
  InventoryStackLimitError,
  InventoryIdempotencyPayloadMismatchError,
  InventoryOverweightError,
  InventoryCapacityError,
  InventoryMetadataValidationError,
  InventorySettingsConflictError,
  InventoryItemBrokenError,
} from '@atc/db'
import {
  ItemNotUsableError,
  ItemCooldownActiveError,
  ItemInsufficientDurabilityError,
} from '@atc/runtime-items'

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

// ── Error mapping ─────────────────────────────────────────────────────────────

async function handleInventoryError(err: unknown, reply: FastifyReply): Promise<void> {
  if (err instanceof InventoryIdempotencyPayloadMismatchError) {
    await reply.code(409).send({ error: err.message })
    return
  }
  if (err instanceof InventoryItemNotFoundError) {
    await reply.code(404).send({ error: err.message })
    return
  }
  if (
    err instanceof InventorySlotOccupiedError ||
    err instanceof InventoryFullError ||
    err instanceof InventorySettingsConflictError
  ) {
    await reply.code(409).send({ error: (err as Error).message })
    return
  }
  if (
    err instanceof InventoryInsufficientQuantityError ||
    err instanceof InventoryStackLimitError ||
    err instanceof InventoryMetadataValidationError
  ) {
    await reply.code(422).send({ error: (err as Error).message })
    return
  }
  if (err instanceof InventoryOverweightError || err instanceof InventoryCapacityError) {
    await reply.code(422).send({ error: (err as Error).message })
    return
  }
  throw err
}

// ── Routes ────────────────────────────────────────────────────────────────────

export const inventoryRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (fastify, { ctx }) => {
  const { inventory, itemRuntime, logger } = ctx

  // ── GET /api/v1/inventory/character/:characterId ──────────────────────────
  fastify.get<{ Params: { characterId: string } }>(
    '/api/v1/inventory/character/:characterId',
    async (req, reply) => {
      const paramResult = validate(inventoryCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const { characterId } = paramResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return
      const result = await inventory.getByCharacter(characterId)
      return reply.code(200).send(result)
    },
  )

  // ── POST /api/v1/inventory/character/:characterId/add ─────────────────────
  fastify.post<{ Params: { characterId: string } }>(
    '/api/v1/inventory/character/:characterId/add',
    async (req, reply) => {
      const paramResult = validate(inventoryCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const bodyResult = validate(inventoryAddSchema, req.body)
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: bodyResult.errors })
      }
      const { characterId } = paramResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      try {
        const d = bodyResult.data
        const result = await inventory.addItem({
          characterId,
          itemId: d.itemId,
          quantity: d.quantity,
          reason: d.reason,
          source: d.source,
          idempotencyKey: d.idempotencyKey,
          ...(d.slot !== undefined ? { slot: d.slot } : {}),
          ...(d.metadata !== undefined ? { metadata: d.metadata } : {}),
        })
        logger.info({ characterId, itemId: d.itemId, idempotent: result.idempotent }, 'inventory add')
        return reply.code(result.idempotent ? 200 : 201).send(result)
      } catch (err) {
        await handleInventoryError(err, reply)
      }
    },
  )

  // ── POST /api/v1/inventory/character/:characterId/remove ──────────────────
  fastify.post<{ Params: { characterId: string } }>(
    '/api/v1/inventory/character/:characterId/remove',
    async (req, reply) => {
      const paramResult = validate(inventoryCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const bodyResult = validate(inventoryRemoveSchema, req.body)
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: bodyResult.errors })
      }
      const { characterId } = paramResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      try {
        const d = bodyResult.data
        const result = await inventory.removeItem({
          characterId,
          itemId: d.itemId,
          quantity: d.quantity,
          reason: d.reason,
          source: d.source,
          idempotencyKey: d.idempotencyKey,
          ...(d.slot !== undefined ? { slot: d.slot } : {}),
        })
        logger.info({ characterId, itemId: d.itemId, idempotent: result.idempotent }, 'inventory remove')
        return reply.code(200).send(result)
      } catch (err) {
        await handleInventoryError(err, reply)
      }
    },
  )

  // ── POST /api/v1/inventory/character/:characterId/move ────────────────────
  fastify.post<{ Params: { characterId: string } }>(
    '/api/v1/inventory/character/:characterId/move',
    async (req, reply) => {
      const paramResult = validate(inventoryCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const bodyResult = validate(inventoryMoveSchema, req.body)
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: bodyResult.errors })
      }
      const { characterId } = paramResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      try {
        const d = bodyResult.data
        const result = await inventory.moveItem({
          characterId,
          fromSlot: d.fromSlot,
          toSlot: d.toSlot,
          idempotencyKey: d.idempotencyKey,
          ...(d.quantity !== undefined ? { quantity: d.quantity } : {}),
        })
        logger.info({ characterId, idempotent: result.idempotent }, 'inventory move')
        return reply.code(200).send(result)
      } catch (err) {
        await handleInventoryError(err, reply)
      }
    },
  )

  // ── GET /api/v1/inventory/character/:characterId/transactions ─────────────
  fastify.get<{ Params: { characterId: string }; Querystring: Record<string, string> }>(
    '/api/v1/inventory/character/:characterId/transactions',
    async (req, reply) => {
      const paramResult = validate(inventoryCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const queryResult = validate(inventoryTransactionQuerySchema, req.query)
      if (!queryResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: queryResult.errors })
      }
      const { characterId } = paramResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      const transactions = await inventory.listTransactions(
        characterId,
        queryResult.data.limit,
        queryResult.data.offset,
      )
      return reply.code(200).send(transactions)
    },
  )

  // ── GET /api/v1/inventory/character/:characterId/settings ─────────────────
  fastify.get<{ Params: { characterId: string } }>(
    '/api/v1/inventory/character/:characterId/settings',
    async (req, reply) => {
      const paramResult = validate(inventoryCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const { characterId } = paramResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      const settings = await inventory.getOrCreateSettings(characterId)
      return reply.code(200).send(settings)
    },
  )

  // ── POST /api/v1/inventory/character/:characterId/use ─────────────────────
  fastify.post<{ Params: { characterId: string } }>(
    '/api/v1/inventory/character/:characterId/use',
    async (req, reply) => {
      const paramResult = validate(inventoryCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const bodyResult = validate(itemUseSchema, req.body)
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: bodyResult.errors })
      }
      const { characterId } = paramResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      try {
        const d = bodyResult.data
        const result = await itemRuntime.useItem(characterId, {
          slot: d.slot,
          idempotencyKey: d.idempotencyKey,
        })
        logger.info({ characterId, slot: d.slot, itemId: result.itemId, idempotent: result.idempotent }, 'item use')
        return reply.code(200).send(result)
      } catch (err) {
        if (err instanceof ItemNotUsableError) {
          return reply.code(403).send({ error: 'Item is not usable', details: err.errors })
        }
        if (err instanceof ItemCooldownActiveError) {
          return reply.code(409).send({
            error: 'Item is on cooldown',
            cooldownExpiresAt: err.expiresAt.toISOString(),
          })
        }
        if (err instanceof ItemInsufficientDurabilityError || err instanceof InventoryItemBrokenError) {
          return reply.code(422).send({ error: err.message })
        }
        if (err instanceof InventoryItemNotFoundError) {
          return reply.code(404).send({ error: err.message })
        }
        if (err instanceof InventoryInsufficientQuantityError) {
          return reply.code(422).send({ error: err.message })
        }
        throw err
      }
    },
  )

  // ── PATCH /api/v1/inventory/character/:characterId/settings ───────────────
  fastify.patch<{ Params: { characterId: string } }>(
    '/api/v1/inventory/character/:characterId/settings',
    async (req, reply) => {
      const paramResult = validate(inventoryCharacterParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const bodyResult = validate(inventoryUpdateSettingsSchema, req.body)
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: bodyResult.errors })
      }
      const { characterId } = paramResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      try {
        const d = bodyResult.data
        const settings = await inventory.updateSettings(characterId, {
          ...(d.maxSlots !== undefined ? { maxSlots: d.maxSlots } : {}),
          ...(d.maxWeightGrams !== undefined ? { maxWeightGrams: d.maxWeightGrams } : {}),
        })
        logger.info({ characterId }, 'inventory settings updated')
        return reply.code(200).send(settings)
      } catch (err) {
        await handleInventoryError(err, reply)
      }
    },
  )

  // ── Ground loot ───────────────────────────────────────────────────────────
  // Piles on the floor, with their contents held here rather than on the
  // clients that draw them. Before this the game layer had a pickup handler
  // calling a route that did not exist, and no way to grant anything even if it
  // had: only the client knew what a pile contained.

  // ── POST /api/v1/inventory/loot ───────────────────────────────────────────
  fastify.post('/api/v1/inventory/loot', async (req, reply) => {
    if (!ctx.groundLoot) return reply.code(503).send({ error: 'Ground loot not configured' })
    const bodyResult = validate(groundLootDropSchema, req.body)
    if (!bodyResult.success) {
      return reply.code(400).send({ error: 'Validation failed', details: bodyResult.errors })
    }
    const d = bodyResult.data
    const loot = await ctx.groundLoot.create({
      x: d.x, y: d.y, z: d.z,
      items: d.items,
      ...(d.droppedByCharacterId !== undefined ? { droppedByCharacterId: d.droppedByCharacterId } : {}),
      ...(d.reason !== undefined ? { reason: d.reason } : {}),
      ...(d.expiresAt !== undefined ? { expiresAt: new Date(d.expiresAt) } : {}),
    })
    logger.info({ lootId: loot.id, items: loot.items.length }, 'ground loot dropped')
    return reply.code(201).send(loot)
  })

  // ── GET /api/v1/inventory/loot ────────────────────────────────────────────
  // Everything still on the ground — what a game server reads on boot to draw
  // the piles that outlived the last restart.
  fastify.get('/api/v1/inventory/loot', async (_req, reply) => {
    if (!ctx.groundLoot) return reply.code(503).send({ error: 'Ground loot not configured' })
    const loot = await ctx.groundLoot.listActive()
    return reply.code(200).send({ loot, total: loot.length })
  })

  // ── GET /api/v1/inventory/loot/:lootId ────────────────────────────────────
  fastify.get<{ Params: { lootId: string } }>(
    '/api/v1/inventory/loot/:lootId',
    async (req, reply) => {
      if (!ctx.groundLoot) return reply.code(503).send({ error: 'Ground loot not configured' })
      const paramResult = validate(groundLootIdParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const loot = await ctx.groundLoot.findById(paramResult.data.lootId)
      if (!loot) return reply.code(404).send({ error: 'Loot not found' })
      return reply.code(200).send(loot)
    },
  )

  // ── POST /api/v1/inventory/loot/:lootId/pickup ────────────────────────────
  fastify.post<{ Params: { lootId: string } }>(
    '/api/v1/inventory/loot/:lootId/pickup',
    async (req, reply) => {
      if (!ctx.groundLoot) return reply.code(503).send({ error: 'Ground loot not configured' })
      const paramResult = validate(groundLootIdParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const bodyResult = validate(groundLootPickupSchema, req.body)
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: bodyResult.errors })
      }
      const { lootId } = paramResult.data
      const { characterId } = bodyResult.data
      if (!await requireActiveCharacter(characterId, ctx, reply)) return

      // Claim first. The claim is the race: whoever's UPDATE changes a row owns
      // the pile, so two players reaching for it cannot both be granted it.
      const claimed = await ctx.groundLoot.claim(lootId, characterId)
      if (!claimed) {
        // Either gone or never there. Told apart so the caller can distinguish
        // "somebody beat you to it" from "that pile does not exist".
        const existing = await ctx.groundLoot.findById(lootId)
        if (!existing) return reply.code(404).send({ error: 'Loot not found' })
        return reply.code(409).send({ error: 'Loot has already been taken', status: existing.status })
      }

      // Grant. Idempotent per pile and item, so a retried pickup of the same
      // pile cannot grant twice even though the claim already succeeded.
      const granted: string[] = []
      try {
        for (const item of claimed.items) {
          await inventory.addItem({
            characterId,
            itemId: item.itemId,
            quantity: item.quantity,
            reason: claimed.reason ?? 'loot:pickup',
            source: 'gameplay',
            idempotencyKey: `loot:${lootId}:${item.itemId}`,
          })
          granted.push(item.itemId)
        }
      } catch (err) {
        // The pile was claimed but not fully granted — a full inventory, an
        // unknown item. Put it back so its contents are not destroyed, then
        // report the failure. Items already granted stay granted: taking them
        // away again would need a removal that could fail in turn.
        const remaining = claimed.items.filter((i) => !granted.includes(i.itemId))
        if (remaining.length > 0 && granted.length === 0) {
          await ctx.groundLoot.release(lootId, characterId)
        }
        logger.warn(
          { lootId, characterId, granted, remaining: remaining.map((i) => i.itemId) },
          'ground loot pickup partially failed',
        )
        await handleInventoryError(err, reply)
        return
      }

      const updated = await inventory.getByCharacter(characterId)
      logger.info({ lootId, characterId, items: claimed.items.length }, 'ground loot picked up')
      return reply.code(200).send({ ...updated, loot: claimed })
    },
  )
}
