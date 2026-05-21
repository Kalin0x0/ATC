import { describe, it, expect } from 'vitest'
import {
  itemDefinitionCreateSchema,
  itemDefinitionUpdateSchema,
  itemDefinitionBulkUpsertSchema,
  itemMetadataValidationSchema,
  itemCatalogQuerySchema,
  itemIdParamSchema,
} from '@atc/schemas'

// ── itemDefinitionCreateSchema ────────────────────────────────────────────────

describe('itemDefinitionCreateSchema — valid input', () => {
  const base = { id: 'water_bottle', label: 'Water Bottle', category: 'consumable' }

  it('accepts minimal valid input with defaults applied', () => {
    const result = itemDefinitionCreateSchema.safeParse(base)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.stackable).toBe(true)
    expect(result.data.maxStack).toBe(100)
    expect(result.data.weightGrams).toBe(0)
    expect(result.data.usable).toBe(false)
    expect(result.data.tradable).toBe(true)
    expect(result.data.status).toBe('active')
    expect(result.data.tags).toEqual([])
    expect(result.data.sortOrder).toBe(0)
  })

  it('forces maxStack to 1 when stackable is false', () => {
    const result = itemDefinitionCreateSchema.safeParse({ ...base, stackable: false, maxStack: 50 })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.stackable).toBe(false)
    expect(result.data.maxStack).toBe(1)
  })

  it('accepts optional imageUrl, icon, tags, and sortOrder', () => {
    const result = itemDefinitionCreateSchema.safeParse({
      ...base,
      imageUrl: 'https://cdn.example.com/items/water.png',
      icon: 'fa-tint',
      tags: ['food', 'drink'],
      sortOrder: 10,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.imageUrl).toBe('https://cdn.example.com/items/water.png')
    expect(result.data.icon).toBe('fa-tint')
    expect(result.data.tags).toEqual(['food', 'drink'])
    expect(result.data.sortOrder).toBe(10)
  })

  it('accepts negative sortOrder values', () => {
    const result = itemDefinitionCreateSchema.safeParse({ ...base, sortOrder: -500 })
    expect(result.success).toBe(true)
  })
})

describe('itemDefinitionCreateSchema — invalid input', () => {
  const base = { id: 'water_bottle', label: 'Water Bottle', category: 'consumable' }

  it('rejects id with uppercase letters', () => {
    const result = itemDefinitionCreateSchema.safeParse({ ...base, id: 'WaterBottle' })
    expect(result.success).toBe(false)
  })

  it('rejects id shorter than 2 characters', () => {
    const result = itemDefinitionCreateSchema.safeParse({ ...base, id: 'w' })
    expect(result.success).toBe(false)
  })

  it('rejects id with spaces', () => {
    const result = itemDefinitionCreateSchema.safeParse({ ...base, id: 'water bottle' })
    expect(result.success).toBe(false)
  })

  it('rejects empty label', () => {
    const result = itemDefinitionCreateSchema.safeParse({ ...base, label: '' })
    expect(result.success).toBe(false)
  })

  it('rejects tags array with more than 20 items', () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`)
    const result = itemDefinitionCreateSchema.safeParse({ ...base, tags })
    expect(result.success).toBe(false)
  })

  it('rejects imageUrl that is not a URL', () => {
    const result = itemDefinitionCreateSchema.safeParse({ ...base, imageUrl: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('rejects icon shorter than 2 characters', () => {
    const result = itemDefinitionCreateSchema.safeParse({ ...base, icon: 'x' })
    expect(result.success).toBe(false)
  })

  it('rejects sortOrder below -100000', () => {
    const result = itemDefinitionCreateSchema.safeParse({ ...base, sortOrder: -100_001 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status value', () => {
    const result = itemDefinitionCreateSchema.safeParse({ ...base, status: 'deleted' })
    expect(result.success).toBe(false)
  })
})

// ── itemDefinitionUpdateSchema ────────────────────────────────────────────────

describe('itemDefinitionUpdateSchema — valid input', () => {
  it('accepts a single field patch', () => {
    const result = itemDefinitionUpdateSchema.safeParse({ label: 'New Label' })
    expect(result.success).toBe(true)
  })

  it('accepts description: null (clear the description)', () => {
    const result = itemDefinitionUpdateSchema.safeParse({ description: null })
    expect(result.success).toBe(true)
  })

  it('accepts metadataSchema: null (clear the schema)', () => {
    const result = itemDefinitionUpdateSchema.safeParse({ metadataSchema: null })
    expect(result.success).toBe(true)
  })

  it('accepts imageUrl: null (clear the image)', () => {
    const result = itemDefinitionUpdateSchema.safeParse({ imageUrl: null })
    expect(result.success).toBe(true)
  })
})

describe('itemDefinitionUpdateSchema — invalid input', () => {
  it('rejects empty object (at least one field required)', () => {
    const result = itemDefinitionUpdateSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects empty label', () => {
    const result = itemDefinitionUpdateSchema.safeParse({ label: '' })
    expect(result.success).toBe(false)
  })

  it('rejects sortOrder above 100000', () => {
    const result = itemDefinitionUpdateSchema.safeParse({ sortOrder: 100_001 })
    expect(result.success).toBe(false)
  })
})

// ── itemDefinitionBulkUpsertSchema ────────────────────────────────────────────

describe('itemDefinitionBulkUpsertSchema — valid input', () => {
  const singleItem = { id: 'bread', label: 'Bread', category: 'food' }

  it('accepts an array of one valid item', () => {
    const result = itemDefinitionBulkUpsertSchema.safeParse({ items: [singleItem] })
    expect(result.success).toBe(true)
  })

  it('accepts up to 500 items', () => {
    const items = Array.from({ length: 500 }, (_, i) => ({
      id: `item_${String(i).padStart(3, '0')}`,
      label: `Item ${i}`,
      category: 'misc',
    }))
    const result = itemDefinitionBulkUpsertSchema.safeParse({ items })
    expect(result.success).toBe(true)
  })
})

describe('itemDefinitionBulkUpsertSchema — invalid input', () => {
  it('rejects empty items array', () => {
    const result = itemDefinitionBulkUpsertSchema.safeParse({ items: [] })
    expect(result.success).toBe(false)
  })

  it('rejects array of 501 items', () => {
    const items = Array.from({ length: 501 }, (_, i) => ({
      id: `item_${String(i).padStart(3, '0')}`,
      label: `Item ${i}`,
      category: 'misc',
    }))
    const result = itemDefinitionBulkUpsertSchema.safeParse({ items })
    expect(result.success).toBe(false)
  })
})

// ── itemCatalogQuerySchema ────────────────────────────────────────────────────

describe('itemCatalogQuerySchema — valid input', () => {
  it('applies default limit 100 and offset 0 for empty input', () => {
    const result = itemCatalogQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.limit).toBe(100)
    expect(result.data.offset).toBe(0)
  })

  it('coerces string limit and offset from query string', () => {
    const result = itemCatalogQuerySchema.safeParse({ limit: '50', offset: '10' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.limit).toBe(50)
    expect(result.data.offset).toBe(10)
  })

  it('accepts valid status values', () => {
    for (const status of ['active', 'disabled', 'deprecated'] as const) {
      const result = itemCatalogQuerySchema.safeParse({ status })
      expect(result.success).toBe(true)
    }
  })

  it('accepts category, tag, and search filters', () => {
    const result = itemCatalogQuerySchema.safeParse({ category: 'food', tag: 'drink', search: 'water' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.category).toBe('food')
    expect(result.data.tag).toBe('drink')
    expect(result.data.search).toBe('water')
  })
})

describe('itemCatalogQuerySchema — invalid input', () => {
  it('rejects invalid status value', () => {
    const result = itemCatalogQuerySchema.safeParse({ status: 'deleted' })
    expect(result.success).toBe(false)
  })

  it('rejects limit above 500', () => {
    const result = itemCatalogQuerySchema.safeParse({ limit: '501' })
    expect(result.success).toBe(false)
  })
})

// ── itemIdParamSchema ─────────────────────────────────────────────────────────

describe('itemIdParamSchema', () => {
  it('accepts a valid item ID', () => {
    const result = itemIdParamSchema.safeParse({ itemId: 'water_bottle' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.itemId).toBe('water_bottle')
  })

  it('rejects an empty string', () => {
    const result = itemIdParamSchema.safeParse({ itemId: '' })
    expect(result.success).toBe(false)
  })

  it('rejects an ID with uppercase letters', () => {
    const result = itemIdParamSchema.safeParse({ itemId: 'WaterBottle' })
    expect(result.success).toBe(false)
  })
})

// ── itemMetadataValidationSchema ──────────────────────────────────────────────

describe('itemMetadataValidationSchema', () => {
  it('accepts metadataSchema without sampleMetadata', () => {
    const result = itemMetadataValidationSchema.safeParse({
      metadataSchema: { properties: { durability: { type: 'number' } } },
    })
    expect(result.success).toBe(true)
  })

  it('accepts metadataSchema with sampleMetadata', () => {
    const result = itemMetadataValidationSchema.safeParse({
      metadataSchema: { properties: { durability: { type: 'number' } } },
      sampleMetadata: { durability: 100 },
    })
    expect(result.success).toBe(true)
  })

  it('rejects input missing metadataSchema', () => {
    const result = itemMetadataValidationSchema.safeParse({ sampleMetadata: { foo: 'bar' } })
    expect(result.success).toBe(false)
  })
})
