import { z } from 'zod'
import { uuidV7Schema } from './helpers.js'
import { idempotencyKeySchema } from './wallet-api.schema.js'

export { idempotencyKeySchema }

const inventoryTransactionSourceSchema = z.enum(['system', 'admin', 'api', 'gameplay'])

const itemDefinitionStatusSchema = z.enum(['active', 'disabled', 'deprecated'])

export const itemIdSchema = z
  .string()
  .trim()
  .min(2, 'Item ID must be at least 2 characters')
  .max(64, 'Item ID must be at most 64 characters')
  .regex(/^[a-z0-9_-]+$/, 'Item ID must be lowercase alphanumeric with hyphens or underscores only')

export const inventorySlotSchema = z
  .number()
  .int('Slot must be an integer')
  .min(1, 'Slot must be at least 1')
  .max(120, 'Slot must be at most 120')

export const inventoryQuantitySchema = z
  .number()
  .int('Quantity must be an integer')
  .min(1, 'Quantity must be at least 1')
  .max(100_000, 'Quantity must be at most 100000')

export const inventoryMetadataSchema = z
  .record(z.unknown())
  .refine((m) => Object.keys(m).length <= 20, 'Metadata must not exceed 20 keys')
  .optional()

export const inventoryAddSchema = z.object({
  itemId: itemIdSchema,
  quantity: inventoryQuantitySchema,
  slot: inventorySlotSchema.optional(),
  reason: z.string().trim().min(1, 'Reason is required').max(128, 'Reason must be at most 128 characters'),
  source: inventoryTransactionSourceSchema,
  idempotencyKey: idempotencyKeySchema,
  metadata: inventoryMetadataSchema,
})

export const inventoryRemoveSchema = z.object({
  itemId: itemIdSchema,
  quantity: inventoryQuantitySchema,
  slot: inventorySlotSchema.optional(),
  reason: z.string().trim().min(1, 'Reason is required').max(128, 'Reason must be at most 128 characters'),
  source: inventoryTransactionSourceSchema,
  idempotencyKey: idempotencyKeySchema,
})

export const inventoryMoveSchema = z
  .object({
    fromSlot: inventorySlotSchema,
    toSlot: inventorySlotSchema,
    quantity: inventoryQuantitySchema.optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .refine((d) => d.fromSlot !== d.toSlot, {
    message: 'fromSlot and toSlot must be different',
    path: ['toSlot'],
  })

export const itemDefinitionUpsertSchema = z
  .object({
    id: itemIdSchema,
    label: z.string().trim().min(1, 'Label is required').max(128, 'Label must be at most 128 characters'),
    description: z.string().trim().max(512, 'Description must be at most 512 characters').optional(),
    category: z.string().trim().min(1, 'Category is required').max(64, 'Category must be at most 64 characters'),
    stackable: z.boolean().default(true),
    maxStack: z.number().int().min(1, 'maxStack must be at least 1').default(100),
    weightGrams: z.number().int().min(0, 'weightGrams must be non-negative').default(0),
    usable: z.boolean().default(false),
    tradable: z.boolean().default(true),
    metadataSchema: z.record(z.unknown()).optional(),
    status: itemDefinitionStatusSchema.default('active'),
  })
  .transform((data) => {
    // BUG-7 fix: non-stackable items must have maxStack=1 regardless of what was provided
    if (!data.stackable) {
      return { ...data, maxStack: 1 }
    }
    return data
  })

export const inventoryCharacterParamSchema = z.object({
  characterId: uuidV7Schema,
})

export const inventoryTransactionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

// ── Settings schemas ──────────────────────────────────────────────────────────

export const inventoryUpdateSettingsSchema = z
  .object({
    maxSlots: z.number().int().min(1).max(120).optional(),
    maxWeightGrams: z.number().int().min(0).optional(),
  })
  .refine(
    (d) => d.maxSlots !== undefined || d.maxWeightGrams !== undefined,
    { message: 'At least one field (maxSlots or maxWeightGrams) must be provided' },
  )

export const inventorySettingsSchema = z.object({
  characterId: uuidV7Schema,
  maxSlots: z.number().int().min(1).max(120),
  maxWeightGrams: z.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
})

// ── Metadata schema definition schemas ───────────────────────────────────────

const inventoryMetadataPropertySchema = z.object({
  type: z.enum(['string', 'number', 'boolean']),
  maxLength: z.number().int().positive().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
})

export const inventoryMetadataSchemaSchema = z.object({
  required: z.array(z.string()).optional(),
  strict: z.boolean().optional(),
  properties: z.record(inventoryMetadataPropertySchema).optional(),
})

export type InventoryAddInput = z.input<typeof inventoryAddSchema>
export type InventoryRemoveInput = z.input<typeof inventoryRemoveSchema>
export type InventoryMoveInput = z.input<typeof inventoryMoveSchema>
export type ItemDefinitionUpsertInput = z.input<typeof itemDefinitionUpsertSchema>
export type InventoryUpdateSettingsInput = z.input<typeof inventoryUpdateSettingsSchema>

// ── Phase 8: Item action config schema (defined here for use in create/update) ─

export const itemActionConfigSchema = z.object({
  type: z.enum(['consume', 'cooldown_only', 'custom_event']),
  cooldownMs: z.number().int().min(0).max(86_400_000, 'cooldownMs must be at most 86400000 (24 hours)').optional(),
  consumeQuantity: z.number().int().min(1, 'consumeQuantity must be at least 1').optional(),
  durabilityCost: z.number().int().min(0, 'durabilityCost must be non-negative').optional(),
  destroyOnEmpty: z.boolean().optional(),
  serverEvent: z
    .string()
    .min(3, 'serverEvent must be at least 3 characters')
    .max(128, 'serverEvent must be at most 128 characters')
    .optional(),
})

// ── Phase 7: Item catalog schemas ─────────────────────────────────────────────

const tagSchema = z
  .string()
  .trim()
  .min(2, 'Tag must be at least 2 characters')
  .max(32, 'Tag must be at most 32 characters')
  .regex(/^[a-z0-9_-]+$/, 'Tag must be lowercase alphanumeric with hyphens or underscores only')

const tagsSchema = z
  .array(tagSchema)
  .max(20, 'A maximum of 20 tags is allowed')
  .default([])

const imageUrlSchema = z
  .string()
  .trim()
  .url('imageUrl must be a valid URL')
  .max(512, 'imageUrl must be at most 512 characters')
  .optional()

const iconSchema = z
  .string()
  .trim()
  .min(2, 'icon must be at least 2 characters')
  .max(128, 'icon must be at most 128 characters')
  .optional()

const sortOrderSchema = z
  .number()
  .int('sortOrder must be an integer')
  .min(-100_000, 'sortOrder must be at least -100000')
  .max(100_000, 'sortOrder must be at most 100000')
  .default(0)

export const itemDefinitionCreateSchema = z
  .object({
    id: itemIdSchema,
    label: z.string().trim().min(1, 'Label is required').max(128, 'Label must be at most 128 characters'),
    description: z.string().trim().max(512, 'Description must be at most 512 characters').optional(),
    category: z.string().trim().min(1, 'Category is required').max(64, 'Category must be at most 64 characters'),
    stackable: z.boolean().default(true),
    maxStack: z.number().int().min(1, 'maxStack must be at least 1').default(100),
    weightGrams: z.number().int().min(0, 'weightGrams must be non-negative').default(0),
    usable: z.boolean().default(false),
    tradable: z.boolean().default(true),
    metadataSchema: z.record(z.unknown()).optional(),
    status: itemDefinitionStatusSchema.default('active'),
    imageUrl: imageUrlSchema,
    icon: iconSchema,
    tags: tagsSchema,
    sortOrder: sortOrderSchema,
    actionConfig: itemActionConfigSchema.optional(),
  })
  .transform((data) => {
    if (!data.stackable) return { ...data, maxStack: 1 }
    return data
  })

export const itemDefinitionUpdateSchema = z
  .object({
    label: z.string().trim().min(1).max(128).optional(),
    description: z.string().trim().max(512).nullable().optional(),
    category: z.string().trim().min(1).max(64).optional(),
    stackable: z.boolean().optional(),
    maxStack: z.number().int().min(1).optional(),
    weightGrams: z.number().int().min(0).optional(),
    usable: z.boolean().optional(),
    tradable: z.boolean().optional(),
    metadataSchema: z.record(z.unknown()).nullable().optional(),
    imageUrl: z.string().trim().url().max(512).nullable().optional(),
    icon: z.string().trim().min(2).max(128).nullable().optional(),
    tags: tagsSchema.optional(),
    sortOrder: z.number().int().min(-100_000).max(100_000).optional(),
    actionConfig: itemActionConfigSchema.nullable().optional(),
  })
  .refine(
    (d) => Object.values(d).some((v) => v !== undefined),
    { message: 'At least one field must be provided for update' },
  )

export const itemDefinitionBulkUpsertSchema = z.object({
  items: z
    .array(itemDefinitionCreateSchema)
    .min(1, 'At least one item is required')
    .max(500, 'Maximum 500 items per bulk request'),
})

export const itemMetadataValidationSchema = z.object({
  metadataSchema: z.record(z.unknown()),
  sampleMetadata: z.record(z.unknown()).optional(),
})

export const itemCatalogQuerySchema = z.object({
  category: z.string().trim().max(64).optional(),
  status: itemDefinitionStatusSchema.optional(),
  tag: tagSchema.optional(),
  search: z.string().trim().max(128).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const itemIdParamSchema = z.object({
  itemId: itemIdSchema,
})

export type ItemDefinitionCreateInput = z.input<typeof itemDefinitionCreateSchema>
export type ItemDefinitionUpdateInput = z.input<typeof itemDefinitionUpdateSchema>
export type ItemDefinitionBulkUpsertInput = z.input<typeof itemDefinitionBulkUpsertSchema>
export type ItemMetadataValidationInput = z.input<typeof itemMetadataValidationSchema>
export type ItemCatalogQueryInput = z.input<typeof itemCatalogQuerySchema>

// ── Phase 8: Item runtime schemas (use request, effect, cooldown) ─────────────

export const itemUseSchema = z.object({
  slot: inventorySlotSchema,
  idempotencyKey: idempotencyKeySchema,
})

export const itemEffectResultSchema = z.object({
  type: z.string().min(1).max(128),
  success: z.boolean(),
  data: z.record(z.unknown()).optional(),
})

export const cooldownSchema = z.object({
  characterId: uuidV7Schema,
  slot: inventorySlotSchema,
  expiresAt: z.date(),
})

export type ItemActionConfigInput = z.input<typeof itemActionConfigSchema>
export type ItemUseInput = z.input<typeof itemUseSchema>
