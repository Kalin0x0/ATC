import { describe, it, expect } from 'vitest'
import { validate } from '@atc/schemas'
import {
  itemIdSchema,
  inventorySlotSchema,
  inventoryQuantitySchema,
  inventoryMetadataSchema,
  inventoryAddSchema,
  inventoryRemoveSchema,
  inventoryMoveSchema,
  itemDefinitionUpsertSchema,
  inventoryUpdateSettingsSchema,
  inventoryMetadataSchemaSchema,
} from '@atc/schemas'

// ── itemIdSchema ──────────────────────────────────────────────────────────────

describe('itemIdSchema', () => {
  it('accepts valid lowercase alphanumeric IDs', () => {
    expect(validate(itemIdSchema, 'water_bottle').success).toBe(true)
    expect(validate(itemIdSchema, 'ak-47').success).toBe(true)
    expect(validate(itemIdSchema, 'ab').success).toBe(true)
  })

  it('rejects uppercase characters', () => {
    expect(validate(itemIdSchema, 'Water_Bottle').success).toBe(false)
  })

  it('rejects IDs shorter than 2 characters', () => {
    expect(validate(itemIdSchema, 'a').success).toBe(false)
  })

  it('rejects IDs longer than 64 characters', () => {
    expect(validate(itemIdSchema, 'a'.repeat(65)).success).toBe(false)
  })

  it('rejects IDs with spaces', () => {
    expect(validate(itemIdSchema, 'water bottle').success).toBe(false)
  })

  it('accepts IDs exactly 64 characters long', () => {
    expect(validate(itemIdSchema, 'a'.repeat(64)).success).toBe(true)
  })
})

// ── inventorySlotSchema ───────────────────────────────────────────────────────

describe('inventorySlotSchema', () => {
  it('accepts slots 1 through 120', () => {
    expect(validate(inventorySlotSchema, 1).success).toBe(true)
    expect(validate(inventorySlotSchema, 60).success).toBe(true)
    expect(validate(inventorySlotSchema, 120).success).toBe(true)
  })

  it('rejects slot 0', () => {
    expect(validate(inventorySlotSchema, 0).success).toBe(false)
  })

  it('rejects slot 121', () => {
    expect(validate(inventorySlotSchema, 121).success).toBe(false)
  })

  it('rejects non-integer slot', () => {
    expect(validate(inventorySlotSchema, 1.5).success).toBe(false)
  })
})

// ── inventoryQuantitySchema ───────────────────────────────────────────────────

describe('inventoryQuantitySchema', () => {
  it('accepts quantity of 1', () => {
    expect(validate(inventoryQuantitySchema, 1).success).toBe(true)
  })

  it('accepts quantity of 100000', () => {
    expect(validate(inventoryQuantitySchema, 100_000).success).toBe(true)
  })

  it('rejects quantity of 0', () => {
    expect(validate(inventoryQuantitySchema, 0).success).toBe(false)
  })

  it('rejects quantity exceeding 100000', () => {
    expect(validate(inventoryQuantitySchema, 100_001).success).toBe(false)
  })

  it('rejects float quantity', () => {
    expect(validate(inventoryQuantitySchema, 1.5).success).toBe(false)
  })
})

// ── inventoryMetadataSchema ───────────────────────────────────────────────────

describe('inventoryMetadataSchema', () => {
  it('accepts metadata with 20 keys', () => {
    const meta = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i]))
    expect(validate(inventoryMetadataSchema, meta).success).toBe(true)
  })

  it('rejects metadata with 21 keys', () => {
    const meta = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i]))
    expect(validate(inventoryMetadataSchema, meta).success).toBe(false)
  })

  it('accepts undefined (optional)', () => {
    expect(validate(inventoryMetadataSchema, undefined).success).toBe(true)
  })
})

// ── inventoryAddSchema ────────────────────────────────────────────────────────

describe('inventoryAddSchema', () => {
  const valid = {
    itemId: 'water_bottle',
    quantity: 1,
    reason: 'pickup',
    source: 'gameplay' as const,
    idempotencyKey: 'idem-001',
  }

  it('accepts a valid add payload', () => {
    expect(validate(inventoryAddSchema, valid).success).toBe(true)
  })

  it('accepts optional slot', () => {
    expect(validate(inventoryAddSchema, { ...valid, slot: 5 }).success).toBe(true)
  })

  it('accepts optional metadata', () => {
    expect(validate(inventoryAddSchema, { ...valid, metadata: { color: 'red' } }).success).toBe(true)
  })

  it('rejects invalid itemId', () => {
    expect(validate(inventoryAddSchema, { ...valid, itemId: 'Bad Item' }).success).toBe(false)
  })

  it('rejects quantity of 0', () => {
    expect(validate(inventoryAddSchema, { ...valid, quantity: 0 }).success).toBe(false)
  })

  it('rejects invalid source', () => {
    expect(validate(inventoryAddSchema, { ...valid, source: 'player' }).success).toBe(false)
  })

  it('rejects empty reason', () => {
    expect(validate(inventoryAddSchema, { ...valid, reason: '' }).success).toBe(false)
  })

  it('rejects empty idempotency key', () => {
    expect(validate(inventoryAddSchema, { ...valid, idempotencyKey: '' }).success).toBe(false)
  })
})

// ── inventoryRemoveSchema ─────────────────────────────────────────────────────

describe('inventoryRemoveSchema', () => {
  const valid = {
    itemId: 'water_bottle',
    quantity: 1,
    reason: 'consumed',
    source: 'gameplay' as const,
    idempotencyKey: 'idem-002',
  }

  it('accepts a valid remove payload', () => {
    expect(validate(inventoryRemoveSchema, valid).success).toBe(true)
  })

  it('rejects quantity of 0', () => {
    expect(validate(inventoryRemoveSchema, { ...valid, quantity: 0 }).success).toBe(false)
  })
})

// ── inventoryMoveSchema ───────────────────────────────────────────────────────

describe('inventoryMoveSchema', () => {
  const valid = {
    fromSlot: 1,
    toSlot: 5,
    idempotencyKey: 'idem-003',
  }

  it('accepts a valid move payload', () => {
    expect(validate(inventoryMoveSchema, valid).success).toBe(true)
  })

  it('rejects when fromSlot equals toSlot', () => {
    expect(validate(inventoryMoveSchema, { ...valid, fromSlot: 3, toSlot: 3 }).success).toBe(false)
  })

  it('rejects slot out of range', () => {
    expect(validate(inventoryMoveSchema, { ...valid, fromSlot: 0 }).success).toBe(false)
    expect(validate(inventoryMoveSchema, { ...valid, toSlot: 121 }).success).toBe(false)
  })

  it('accepts optional quantity', () => {
    expect(validate(inventoryMoveSchema, { ...valid, quantity: 3 }).success).toBe(true)
  })
})

// ── itemDefinitionUpsertSchema ────────────────────────────────────────────────

describe('itemDefinitionUpsertSchema', () => {
  const valid = {
    id: 'water_bottle',
    label: 'Water Bottle',
    category: 'consumable',
  }

  it('accepts minimal valid payload and applies defaults', () => {
    const result = validate(itemDefinitionUpsertSchema, valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.stackable).toBe(true)
      expect(result.data.maxStack).toBe(100)
      expect(result.data.weightGrams).toBe(0)
      expect(result.data.usable).toBe(false)
      expect(result.data.tradable).toBe(true)
      expect(result.data.status).toBe('active')
    }
  })

  it('accepts all valid status values', () => {
    for (const status of ['active', 'disabled', 'deprecated']) {
      expect(validate(itemDefinitionUpsertSchema, { ...valid, status }).success).toBe(true)
    }
  })

  it('rejects invalid item ID (uppercase)', () => {
    expect(validate(itemDefinitionUpsertSchema, { ...valid, id: 'Water_Bottle' }).success).toBe(false)
  })

  it('rejects maxStack of 0', () => {
    expect(validate(itemDefinitionUpsertSchema, { ...valid, maxStack: 0 }).success).toBe(false)
  })

  it('rejects negative weightGrams', () => {
    expect(validate(itemDefinitionUpsertSchema, { ...valid, weightGrams: -1 }).success).toBe(false)
  })

  it('accepts description optional', () => {
    expect(validate(itemDefinitionUpsertSchema, { ...valid, description: 'A cold drink' }).success).toBe(true)
  })

  it('auto-sets maxStack=1 when stackable=false (BUG-7 fix)', () => {
    const result = validate(itemDefinitionUpsertSchema, { ...valid, stackable: false, maxStack: 500 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.stackable).toBe(false)
      expect(result.data.maxStack).toBe(1)
    }
  })

  it('auto-sets maxStack=1 when stackable=false even without explicit maxStack', () => {
    const result = validate(itemDefinitionUpsertSchema, { ...valid, stackable: false })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.maxStack).toBe(1)
    }
  })

  it('preserves maxStack when stackable=true', () => {
    const result = validate(itemDefinitionUpsertSchema, { ...valid, stackable: true, maxStack: 50 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.maxStack).toBe(50)
    }
  })
})

// ── inventoryUpdateSettingsSchema ─────────────────────────────────────────────

describe('inventoryUpdateSettingsSchema', () => {
  it('accepts maxSlots only', () => {
    expect(validate(inventoryUpdateSettingsSchema, { maxSlots: 40 }).success).toBe(true)
  })

  it('accepts maxWeightGrams only', () => {
    expect(validate(inventoryUpdateSettingsSchema, { maxWeightGrams: 10000 }).success).toBe(true)
  })

  it('accepts both fields', () => {
    expect(validate(inventoryUpdateSettingsSchema, { maxSlots: 80, maxWeightGrams: 50000 }).success).toBe(true)
  })

  it('rejects empty object (no fields provided)', () => {
    expect(validate(inventoryUpdateSettingsSchema, {}).success).toBe(false)
  })

  it('rejects maxSlots below 1', () => {
    expect(validate(inventoryUpdateSettingsSchema, { maxSlots: 0 }).success).toBe(false)
  })

  it('rejects maxSlots above 120', () => {
    expect(validate(inventoryUpdateSettingsSchema, { maxSlots: 121 }).success).toBe(false)
  })

  it('rejects negative maxWeightGrams', () => {
    expect(validate(inventoryUpdateSettingsSchema, { maxWeightGrams: -1 }).success).toBe(false)
  })

  it('accepts maxWeightGrams of 0 (unlimited weight mode)', () => {
    expect(validate(inventoryUpdateSettingsSchema, { maxWeightGrams: 0 }).success).toBe(true)
  })
})

// ── inventoryMetadataSchemaSchema ─────────────────────────────────────────────

describe('inventoryMetadataSchemaSchema', () => {
  it('accepts an empty schema definition', () => {
    expect(validate(inventoryMetadataSchemaSchema, {}).success).toBe(true)
  })

  it('accepts a full schema with required and properties', () => {
    const schema = {
      required: ['color'],
      strict: true,
      properties: {
        color: { type: 'string', maxLength: 32 },
        weight: { type: 'number', min: 0, max: 100 },
        active: { type: 'boolean' },
      },
    }
    expect(validate(inventoryMetadataSchemaSchema, schema).success).toBe(true)
  })

  it('rejects invalid property type', () => {
    const schema = {
      properties: {
        count: { type: 'array' },
      },
    }
    expect(validate(inventoryMetadataSchemaSchema, schema).success).toBe(false)
  })

  it('accepts schema without strict mode', () => {
    expect(validate(inventoryMetadataSchemaSchema, { properties: { tag: { type: 'string' } } }).success).toBe(true)
  })
})
