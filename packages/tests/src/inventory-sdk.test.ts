import { describe, it, expect, vi } from 'vitest'
import { AtcInventorySDK, AtcItemsSDK } from '@atc/sdk'
import type { HttpResponse } from '@atc/sdk'

const CHAR_ID = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'

function makeHttp<T>(response: HttpResponse<T>) {
  return {
    get: vi.fn().mockResolvedValue(response),
    post: vi.fn().mockResolvedValue(response),
    patch: vi.fn().mockResolvedValue(response),
  } as unknown as ConstructorParameters<typeof AtcInventorySDK>[0]
}

// ── AtcItemsSDK ───────────────────────────────────────────────────────────────

describe('AtcItemsSDK — list', () => {
  it('returns items on success', async () => {
    const items = [{ id: 'water_bottle', label: 'Water Bottle' }]
    const sdk = new AtcItemsSDK(makeHttp({ ok: true, status: 200, data: items }))
    const result = await sdk.list()
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('water_bottle')
  })

  it('returns empty array on failure', async () => {
    const sdk = new AtcItemsSDK(makeHttp({ ok: false, status: 500, data: null as unknown as never[] }))
    const result = await sdk.list()
    expect(result).toEqual([])
  })
})

describe('AtcItemsSDK — upsert', () => {
  it('returns upserted item on success', async () => {
    const item = { id: 'bread', label: 'Bread', category: 'food' }
    const sdk = new AtcItemsSDK(makeHttp({ ok: true, status: 200, data: item }))
    const result = await sdk.upsert({ id: 'bread', label: 'Bread', category: 'food' })
    expect(result).toMatchObject({ id: 'bread' })
  })

  it('returns null on failure', async () => {
    const sdk = new AtcItemsSDK(makeHttp({ ok: false, status: 422, data: null as unknown as never }))
    const result = await sdk.upsert({ id: 'bad', label: 'x', category: 'x' })
    expect(result).toBeNull()
  })
})

// ── AtcInventorySDK — get ─────────────────────────────────────────────────────

describe('AtcInventorySDK — get', () => {
  it('returns inventory on success', async () => {
    const settings = { characterId: CHAR_ID, maxSlots: 60, maxWeightGrams: 30_000, createdAt: new Date(), updatedAt: new Date() }
    const inv = {
      characterId: CHAR_ID,
      slots: [],
      settings,
      weightSummary: { totalWeightGrams: 0, maxWeightGrams: 30_000, isOverweight: false, remainingWeightGrams: 30_000 },
      capacitySummary: { usedSlots: 0, maxSlots: 60, freeSlots: 60, isFull: false },
    }
    const sdk = new AtcInventorySDK(makeHttp({ ok: true, status: 200, data: inv }))
    const result = await sdk.get(CHAR_ID)
    expect(result?.characterId).toBe(CHAR_ID)
    expect(result?.settings.maxSlots).toBe(60)
    expect(result?.weightSummary.remainingWeightGrams).toBe(30_000)
    expect(result?.capacitySummary.freeSlots).toBe(60)
  })

  it('returns null on failure', async () => {
    const sdk = new AtcInventorySDK(makeHttp({ ok: false, status: 404, data: null as unknown as never }))
    const result = await sdk.get(CHAR_ID)
    expect(result).toBeNull()
  })
})

// ── AtcInventorySDK — addItem ─────────────────────────────────────────────────

describe('AtcInventorySDK — addItem', () => {
  it('returns mutation result on success', async () => {
    const mutation = { transactionId: 'tx1', characterId: CHAR_ID, slot: 1, itemId: 'water_bottle', quantity: 1, type: 'add', idempotent: false }
    const sdk = new AtcInventorySDK(makeHttp({ ok: true, status: 201, data: mutation }))
    const result = await sdk.addItem(CHAR_ID, { itemId: 'water_bottle', quantity: 1, reason: 'test', source: 'system', idempotencyKey: 'k1' })
    expect(result?.transactionId).toBe('tx1')
  })

  it('returns null on failure', async () => {
    const sdk = new AtcInventorySDK(makeHttp({ ok: false, status: 422, data: null as unknown as never }))
    const result = await sdk.addItem(CHAR_ID, { itemId: 'missing', quantity: 1, reason: 'test', source: 'system', idempotencyKey: 'k2' })
    expect(result).toBeNull()
  })
})

// ── AtcInventorySDK — removeItem ──────────────────────────────────────────────

describe('AtcInventorySDK — removeItem', () => {
  it('returns mutation result on success', async () => {
    const mutation = { transactionId: 'tx2', characterId: CHAR_ID, slot: 1, itemId: 'water_bottle', quantity: 1, type: 'remove', idempotent: false }
    const sdk = new AtcInventorySDK(makeHttp({ ok: true, status: 200, data: mutation }))
    const result = await sdk.removeItem(CHAR_ID, { itemId: 'water_bottle', quantity: 1, reason: 'test', source: 'system', idempotencyKey: 'k3' })
    expect(result?.type).toBe('remove')
  })

  it('returns null on failure', async () => {
    const sdk = new AtcInventorySDK(makeHttp({ ok: false, status: 422, data: null as unknown as never }))
    const result = await sdk.removeItem(CHAR_ID, { itemId: 'water_bottle', quantity: 1, reason: 'test', source: 'system', idempotencyKey: 'k4' })
    expect(result).toBeNull()
  })
})

// ── AtcInventorySDK — moveItem ────────────────────────────────────────────────

describe('AtcInventorySDK — moveItem', () => {
  it('returns mutation result on success', async () => {
    const mutation = { transactionId: 'tx3', characterId: CHAR_ID, slot: 5, itemId: 'water_bottle', quantity: 1, type: 'move', idempotent: false }
    const sdk = new AtcInventorySDK(makeHttp({ ok: true, status: 200, data: mutation }))
    const result = await sdk.moveItem(CHAR_ID, { fromSlot: 1, toSlot: 5, idempotencyKey: 'k5' })
    expect(result?.slot).toBe(5)
  })
})

// ── AtcInventorySDK — listTransactions ───────────────────────────────────────

describe('AtcInventorySDK — listTransactions', () => {
  it('returns transactions on success', async () => {
    const txList = [{ id: 'tx1', type: 'add' }]
    const sdk = new AtcInventorySDK(makeHttp({ ok: true, status: 200, data: txList }))
    const result = await sdk.listTransactions(CHAR_ID)
    expect(result).toHaveLength(1)
  })

  it('returns empty array on failure', async () => {
    const sdk = new AtcInventorySDK(makeHttp({ ok: false, status: 404, data: null as unknown as never[] }))
    const result = await sdk.listTransactions(CHAR_ID)
    expect(result).toEqual([])
  })
})

// ── AtcInventorySDK — getSettings ─────────────────────────────────────────────

describe('AtcInventorySDK — getSettings', () => {
  it('returns settings on success', async () => {
    const settings = { characterId: CHAR_ID, maxSlots: 60, maxWeightGrams: 30_000, createdAt: new Date(), updatedAt: new Date() }
    const sdk = new AtcInventorySDK(makeHttp({ ok: true, status: 200, data: settings }))
    const result = await sdk.getSettings(CHAR_ID)
    expect(result?.maxSlots).toBe(60)
    expect(result?.maxWeightGrams).toBe(30_000)
  })

  it('returns null on failure', async () => {
    const sdk = new AtcInventorySDK(makeHttp({ ok: false, status: 404, data: null as unknown as never }))
    const result = await sdk.getSettings(CHAR_ID)
    expect(result).toBeNull()
  })
})

// ── AtcInventorySDK — updateSettings ─────────────────────────────────────────

describe('AtcInventorySDK — updateSettings', () => {
  it('returns updated settings on success', async () => {
    const settings = { characterId: CHAR_ID, maxSlots: 80, maxWeightGrams: 30_000, createdAt: new Date(), updatedAt: new Date() }
    const sdk = new AtcInventorySDK(makeHttp({ ok: true, status: 200, data: settings }))
    const result = await sdk.updateSettings(CHAR_ID, { maxSlots: 80 })
    expect(result?.maxSlots).toBe(80)
  })

  it('returns null on conflict error', async () => {
    const sdk = new AtcInventorySDK(makeHttp({ ok: false, status: 409, data: null as unknown as never }))
    const result = await sdk.updateSettings(CHAR_ID, { maxSlots: 5 })
    expect(result).toBeNull()
  })
})

// ── AtcItemsSDK Phase 7 — catalog ────────────────────────────────────────────

describe('AtcItemsSDK — catalog', () => {
  it('returns filtered items on success', async () => {
    const items = [{ id: 'water_bottle', label: 'Water Bottle', category: 'consumable' }]
    const sdk = new AtcItemsSDK(makeHttp({ ok: true, status: 200, data: items }))
    const result = await sdk.catalog({ category: 'consumable' })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('water_bottle')
  })

  it('returns empty array on failure', async () => {
    const sdk = new AtcItemsSDK(makeHttp({ ok: false, status: 400, data: null as unknown as never[] }))
    const result = await sdk.catalog()
    expect(result).toEqual([])
  })
})

// ── AtcItemsSDK Phase 7 — create ─────────────────────────────────────────────

describe('AtcItemsSDK — create', () => {
  it('returns created item on success', async () => {
    const item = { id: 'bread', label: 'Bread', category: 'food' }
    const sdk = new AtcItemsSDK(makeHttp({ ok: true, status: 200, data: item }))
    const result = await sdk.create({ id: 'bread', label: 'Bread', category: 'food' })
    expect(result).toMatchObject({ id: 'bread' })
  })

  it('returns null on failure', async () => {
    const sdk = new AtcItemsSDK(makeHttp({ ok: false, status: 409, data: null as unknown as never }))
    const result = await sdk.create({ id: 'bread', label: 'Bread', category: 'food' })
    expect(result).toBeNull()
  })
})

// ── AtcItemsSDK Phase 7 — update ─────────────────────────────────────────────

describe('AtcItemsSDK — update', () => {
  it('returns updated item on success', async () => {
    const item = { id: 'water_bottle', label: 'Sparkling Water', category: 'consumable' }
    const sdk = new AtcItemsSDK(makeHttp({ ok: true, status: 200, data: item }))
    const result = await sdk.update('water_bottle', { label: 'Sparkling Water' })
    expect(result?.label).toBe('Sparkling Water')
  })

  it('returns null when item not found', async () => {
    const sdk = new AtcItemsSDK(makeHttp({ ok: false, status: 404, data: null as unknown as never }))
    const result = await sdk.update('ghost_item', { label: 'Ghost' })
    expect(result).toBeNull()
  })
})

// ── AtcItemsSDK Phase 7 — bulkUpsert ─────────────────────────────────────────

describe('AtcItemsSDK — bulkUpsert', () => {
  it('returns bulk upsert response on success', async () => {
    const response = { upserted: 2, items: [{ id: 'a' }, { id: 'b' }] }
    const sdk = new AtcItemsSDK(makeHttp({ ok: true, status: 200, data: response }))
    const result = await sdk.bulkUpsert({ items: [
      { id: 'a', label: 'A', category: 'misc' },
      { id: 'b', label: 'B', category: 'misc' },
    ] })
    expect(result?.upserted).toBe(2)
    expect(result?.items).toHaveLength(2)
  })

  it('returns null on failure', async () => {
    const sdk = new AtcItemsSDK(makeHttp({ ok: false, status: 409, data: null as unknown as never }))
    const result = await sdk.bulkUpsert({ items: [{ id: 'dup', label: 'Dup', category: 'x' }, { id: 'dup', label: 'Dup2', category: 'x' }] })
    expect(result).toBeNull()
  })
})

// ── AtcItemsSDK Phase 7 — disable ────────────────────────────────────────────

describe('AtcItemsSDK — disable', () => {
  it('returns disabled item on success', async () => {
    const item = { id: 'water_bottle', status: 'disabled' }
    const sdk = new AtcItemsSDK(makeHttp({ ok: true, status: 200, data: item }))
    const result = await sdk.disable('water_bottle')
    expect(result?.status).toBe('disabled')
  })

  it('returns null when item not found', async () => {
    const sdk = new AtcItemsSDK(makeHttp({ ok: false, status: 404, data: null as unknown as never }))
    const result = await sdk.disable('ghost_item')
    expect(result).toBeNull()
  })
})

// ── AtcItemsSDK Phase 7 — deprecate ──────────────────────────────────────────

describe('AtcItemsSDK — deprecate', () => {
  it('returns deprecated item on success', async () => {
    const item = { id: 'water_bottle', status: 'deprecated' }
    const sdk = new AtcItemsSDK(makeHttp({ ok: true, status: 200, data: item }))
    const result = await sdk.deprecate('water_bottle')
    expect(result?.status).toBe('deprecated')
  })

  it('returns null on failure', async () => {
    const sdk = new AtcItemsSDK(makeHttp({ ok: false, status: 404, data: null as unknown as never }))
    const result = await sdk.deprecate('ghost_item')
    expect(result).toBeNull()
  })
})

// ── AtcInventorySDK Phase 8 — useItem ────────────────────────────────────────

describe('AtcInventorySDK — useItem', () => {
  const useRequest = { slot: 5, idempotencyKey: 'atc:use:1:char:5:12345:999' }

  it('returns use response on success', async () => {
    const useResponse = {
      success: true,
      itemId: 'medkit',
      slot: 5,
      consumed: 1,
      remainingQuantity: 2,
      durability: null,
      cooldownExpiresAt: null,
      effects: [],
      idempotent: false,
    }
    const sdk = new AtcInventorySDK(makeHttp({ ok: true, status: 200, data: useResponse }))
    const result = await sdk.useItem(CHAR_ID, useRequest)
    expect(result?.success).toBe(true)
    expect(result?.itemId).toBe('medkit')
    expect(result?.slot).toBe(5)
    expect(result?.consumed).toBe(1)
    expect(result?.remainingQuantity).toBe(2)
    expect(result?.idempotent).toBe(false)
  })

  it('returns null on failure (403 not usable)', async () => {
    const sdk = new AtcInventorySDK(makeHttp({ ok: false, status: 403, data: null as unknown as never }))
    const result = await sdk.useItem(CHAR_ID, useRequest)
    expect(result).toBeNull()
  })

  it('returns null on failure (409 cooldown)', async () => {
    const sdk = new AtcInventorySDK(makeHttp({ ok: false, status: 409, data: null as unknown as never }))
    const result = await sdk.useItem(CHAR_ID, useRequest)
    expect(result).toBeNull()
  })

  it('returns null when slot is empty (404)', async () => {
    const sdk = new AtcInventorySDK(makeHttp({ ok: false, status: 404, data: null as unknown as never }))
    const result = await sdk.useItem(CHAR_ID, useRequest)
    expect(result).toBeNull()
  })
})

// ── AtcItemsSDK Phase 7 — validateMetadata ───────────────────────────────────

describe('AtcItemsSDK — validateMetadata', () => {
  it('returns validation result on success', async () => {
    const response = { valid: true, errors: [] }
    const sdk = new AtcItemsSDK(makeHttp({ ok: true, status: 200, data: response }))
    const result = await sdk.validateMetadata({ metadataSchema: { properties: { durability: { type: 'number' } } } })
    expect(result?.valid).toBe(true)
    expect(result?.errors).toEqual([])
  })

  it('returns validation result with errors for bad sample', async () => {
    const response = { valid: false, errors: ["'durability' must be a number"] }
    const sdk = new AtcItemsSDK(makeHttp({ ok: true, status: 200, data: response }))
    const result = await sdk.validateMetadata({
      metadataSchema: { properties: { durability: { type: 'number' } } },
      sampleMetadata: { durability: 'not-a-number' },
    })
    expect(result?.valid).toBe(false)
    expect(result?.errors).toHaveLength(1)
  })

  it('returns null on request failure', async () => {
    const sdk = new AtcItemsSDK(makeHttp({ ok: false, status: 400, data: null as unknown as never }))
    const result = await sdk.validateMetadata({ metadataSchema: {} })
    expect(result).toBeNull()
  })
})
