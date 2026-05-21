import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import type { AppContext } from '../context.js'
import { validate } from '@atc/schemas'
import {
  itemDefinitionUpsertSchema,
  itemDefinitionCreateSchema,
  itemDefinitionUpdateSchema,
  itemDefinitionBulkUpsertSchema,
  itemMetadataValidationSchema,
  itemCatalogQuerySchema,
  itemIdParamSchema,
  inventoryMetadataSchemaSchema,
} from '@atc/schemas'
import {
  ItemDefinitionDuplicateError,
  ItemDefinitionNotFoundError,
  validateMetadataSchema,
} from '@atc/db'

// ── Error mapping ─────────────────────────────────────────────────────────────

async function handleItemError(err: unknown, reply: FastifyReply): Promise<void> {
  if (err instanceof ItemDefinitionDuplicateError) {
    await reply.code(409).send({ error: err.message })
    return
  }
  if (err instanceof ItemDefinitionNotFoundError) {
    await reply.code(404).send({ error: err.message })
    return
  }
  throw err
}

// ── metadataSchema format guard (BUG-7-3) ────────────────────────────────────
// Validates that a metadataSchema value conforms to the supported spec before
// it is stored. Returns formatted error strings, or null if valid.

function checkMetadataSchemaFormat(schema: Record<string, unknown>): string[] | null {
  const result = inventoryMetadataSchemaSchema.safeParse(schema)
  if (!result.success) {
    return result.error.issues.map(
      (i) => `Schema format error at '${i.path.join('.') || 'root'}': ${i.message}`,
    )
  }
  return null
}

// ── Routes ────────────────────────────────────────────────────────────────────

export const itemRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (fastify, { ctx }) => {
  const { itemDefinitions, logger } = ctx

  // ── GET /api/v1/items — active items list ─────────────────────────────────
  fastify.get('/api/v1/items', async (_req, reply) => {
    const items = await itemDefinitions.listActive()
    return reply.code(200).send(items)
  })

  // ── POST /api/v1/items — legacy upsert ────────────────────────────────────
  fastify.post('/api/v1/items', async (req, reply) => {
    const result = validate(itemDefinitionUpsertSchema, req.body)
    if (!result.success) {
      return reply.code(400).send({ error: 'Validation failed', details: result.errors })
    }

    const d = result.data
    const item = await itemDefinitions.upsert({
      id: d.id,
      label: d.label,
      category: d.category,
      stackable: d.stackable,
      maxStack: d.maxStack,
      weightGrams: d.weightGrams,
      usable: d.usable,
      tradable: d.tradable,
      status: d.status,
      ...(d.description !== undefined ? { description: d.description } : {}),
      ...(d.metadataSchema !== undefined ? { metadataSchema: d.metadataSchema } : {}),
    })
    logger.info({ itemId: item.id }, 'item definition upserted')
    return reply.code(200).send(item)
  })

  // ── GET /api/v1/items/catalog — admin filtered view (all statuses) ─────────
  fastify.get<{ Querystring: Record<string, string> }>(
    '/api/v1/items/catalog',
    async (req, reply) => {
      const queryResult = validate(itemCatalogQuerySchema, req.query)
      if (!queryResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: queryResult.errors })
      }
      const q = queryResult.data
      const items = await itemDefinitions.listCatalog({
        limit: q.limit,
        offset: q.offset,
        ...(q.category !== undefined ? { category: q.category } : {}),
        ...(q.status !== undefined ? { status: q.status } : {}),
        ...(q.tag !== undefined ? { tag: q.tag } : {}),
        ...(q.search !== undefined ? { search: q.search } : {}),
      })
      return reply.code(200).send(items)
    },
  )

  // ── POST /api/v1/items/create — strict CREATE (409 on duplicate) ──────────
  // BUG-7-1: sdk.create() was calling the legacy upsert endpoint which silently
  // overwrites duplicates. This dedicated route enforces INSERT-only semantics.
  fastify.post('/api/v1/items/create', async (req, reply) => {
    const result = validate(itemDefinitionCreateSchema, req.body)
    if (!result.success) {
      return reply.code(400).send({ error: 'Validation failed', details: result.errors })
    }

    const d = result.data

    // BUG-7-3: validate metadataSchema format before storing
    if (d.metadataSchema !== undefined) {
      const schemaErrors = checkMetadataSchemaFormat(d.metadataSchema as Record<string, unknown>)
      if (schemaErrors) {
        return reply.code(400).send({ error: 'Invalid metadataSchema format', details: schemaErrors })
      }
    }

    try {
      const item = await itemDefinitions.create({
        id: d.id,
        label: d.label,
        category: d.category,
        stackable: d.stackable,
        maxStack: d.maxStack,
        weightGrams: d.weightGrams,
        usable: d.usable,
        tradable: d.tradable,
        status: d.status,
        tags: d.tags,
        sortOrder: d.sortOrder,
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.metadataSchema !== undefined ? { metadataSchema: d.metadataSchema } : {}),
        ...(d.imageUrl !== undefined ? { imageUrl: d.imageUrl } : {}),
        ...(d.icon !== undefined ? { icon: d.icon } : {}),
      })
      logger.info({ itemId: item.id }, 'item definition created')
      return reply.code(201).send(item)
    } catch (err) {
      await handleItemError(err, reply)
    }
  })

  // ── POST /api/v1/items/bulk — transactional bulk upsert ───────────────────
  fastify.post('/api/v1/items/bulk', async (req, reply) => {
    const bodyResult = validate(itemDefinitionBulkUpsertSchema, req.body)
    if (!bodyResult.success) {
      return reply.code(400).send({ error: 'Validation failed', details: bodyResult.errors })
    }

    const { items } = bodyResult.data

    // Duplicate ID guard — 409 per spec
    const ids = items.map((i) => i.id)
    if (new Set(ids).size !== ids.length) {
      const seen = new Set<string>()
      const dupes = [...new Set(ids.filter((id) => { const dup = seen.has(id); seen.add(id); return dup }))]
      return reply.code(409).send({ error: `Duplicate item IDs in bulk request: ${dupes.join(', ')}` })
    }

    // BUG-7-3: validate each item's metadataSchema format before any DB writes
    for (const item of items) {
      if (item.metadataSchema !== undefined) {
        const schemaErrors = checkMetadataSchemaFormat(item.metadataSchema as Record<string, unknown>)
        if (schemaErrors) {
          return reply.code(400).send({
            error: `Invalid metadataSchema format for item '${item.id}'`,
            details: schemaErrors,
          })
        }
      }
    }

    try {
      const result = await itemDefinitions.bulkUpsert(items.map((d) => ({
        id: d.id,
        label: d.label,
        category: d.category,
        stackable: d.stackable,
        maxStack: d.maxStack,
        weightGrams: d.weightGrams,
        usable: d.usable,
        tradable: d.tradable,
        status: d.status,
        tags: d.tags,
        sortOrder: d.sortOrder,
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.metadataSchema !== undefined ? { metadataSchema: d.metadataSchema } : {}),
        ...(d.imageUrl !== undefined ? { imageUrl: d.imageUrl } : {}),
        ...(d.icon !== undefined ? { icon: d.icon } : {}),
      })))
      logger.info({ count: result.upserted }, 'item definitions bulk upserted')
      return reply.code(200).send(result)
    } catch (err) {
      await handleItemError(err, reply)
    }
  })

  // ── POST /api/v1/items/metadata/validate ──────────────────────────────────
  fastify.post('/api/v1/items/metadata/validate', async (req, reply) => {
    const bodyResult = validate(itemMetadataValidationSchema, req.body)
    if (!bodyResult.success) {
      return reply.code(400).send({ error: 'Validation failed', details: bodyResult.errors })
    }

    const { metadataSchema: rawSchema, sampleMetadata } = bodyResult.data
    const errors: string[] = []

    // Validate schema FORMAT against the supported spec
    const schemaFormatResult = inventoryMetadataSchemaSchema.safeParse(rawSchema)
    if (!schemaFormatResult.success) {
      const formatErrors = schemaFormatResult.error.issues.map(
        (i) => `Schema format error at '${i.path.join('.') || 'root'}': ${i.message}`,
      )
      return reply.code(200).send({ valid: false, errors: formatErrors })
    }

    // If sampleMetadata provided, validate it against the schema
    if (sampleMetadata !== undefined) {
      const metaErrors = validateMetadataSchema(rawSchema as Record<string, unknown>, sampleMetadata)
      errors.push(...metaErrors)
    }

    return reply.code(200).send({ valid: errors.length === 0, errors })
  })

  // ── PATCH /api/v1/items/:itemId ───────────────────────────────────────────
  fastify.patch<{ Params: { itemId: string } }>(
    '/api/v1/items/:itemId',
    async (req, reply) => {
      const paramResult = validate(itemIdParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      const bodyResult = validate(itemDefinitionUpdateSchema, req.body)
      if (!bodyResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: bodyResult.errors })
      }

      const { itemId } = paramResult.data
      const d = bodyResult.data

      // BUG-7-3: validate metadataSchema format if provided and non-null
      if (d.metadataSchema !== undefined && d.metadataSchema !== null) {
        const schemaErrors = checkMetadataSchemaFormat(d.metadataSchema as Record<string, unknown>)
        if (schemaErrors) {
          return reply.code(400).send({ error: 'Invalid metadataSchema format', details: schemaErrors })
        }
      }

      try {
        const item = await itemDefinitions.update(itemId, {
          ...(d.label !== undefined ? { label: d.label } : {}),
          ...(d.description !== undefined ? { description: d.description } : {}),
          ...(d.category !== undefined ? { category: d.category } : {}),
          ...(d.stackable !== undefined ? { stackable: d.stackable } : {}),
          ...(d.maxStack !== undefined ? { maxStack: d.maxStack } : {}),
          ...(d.weightGrams !== undefined ? { weightGrams: d.weightGrams } : {}),
          ...(d.usable !== undefined ? { usable: d.usable } : {}),
          ...(d.tradable !== undefined ? { tradable: d.tradable } : {}),
          ...(d.metadataSchema !== undefined ? { metadataSchema: d.metadataSchema } : {}),
          ...(d.imageUrl !== undefined ? { imageUrl: d.imageUrl } : {}),
          ...(d.icon !== undefined ? { icon: d.icon } : {}),
          ...(d.tags !== undefined ? { tags: d.tags } : {}),
          ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
        })
        logger.info({ itemId }, 'item definition updated')
        return reply.code(200).send(item)
      } catch (err) {
        await handleItemError(err, reply)
      }
    },
  )

  // ── POST /api/v1/items/:itemId/disable ────────────────────────────────────
  fastify.post<{ Params: { itemId: string } }>(
    '/api/v1/items/:itemId/disable',
    async (req, reply) => {
      const paramResult = validate(itemIdParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      try {
        const item = await itemDefinitions.safeDisable(paramResult.data.itemId)
        logger.info({ itemId: paramResult.data.itemId }, 'item definition disabled')
        return reply.code(200).send(item)
      } catch (err) {
        await handleItemError(err, reply)
      }
    },
  )

  // ── POST /api/v1/items/:itemId/deprecate ──────────────────────────────────
  fastify.post<{ Params: { itemId: string } }>(
    '/api/v1/items/:itemId/deprecate',
    async (req, reply) => {
      const paramResult = validate(itemIdParamSchema, req.params)
      if (!paramResult.success) {
        return reply.code(400).send({ error: 'Validation failed', details: paramResult.errors })
      }
      try {
        const item = await itemDefinitions.safeDeprecate(paramResult.data.itemId)
        logger.info({ itemId: paramResult.data.itemId }, 'item definition deprecated')
        return reply.code(200).send(item)
      } catch (err) {
        await handleItemError(err, reply)
      }
    },
  )
}
