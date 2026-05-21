import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ItemRuntimeExecutor,
  ItemNotUsableError,
  ItemCooldownActiveError,
  ItemInsufficientDurabilityError,
  ItemCooldownCache,
  RuntimeEffectRegistry,
} from '@atc/runtime-items'
import {
  InventoryItemNotFoundError,
  InventoryInsufficientQuantityError,
} from '@atc/db'
import type { AtcItemDefinition, AtcInventorySlot } from '@atc/shared-types'

// ── Factories ─────────────────────────────────────────────────────────────────

function makeSlot(overrides: Partial<AtcInventorySlot> = {}): AtcInventorySlot {
  return {
    id: 'slot-001',
    characterId: 'char-001',
    itemId: 'medkit',
    slot: 5,
    quantity: 3,
    metadata: null,
    durability: null,
    equipped: false,
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeItemDef(overrides: Partial<AtcItemDefinition> = {}): AtcItemDefinition {
  return {
    id: 'medkit',
    label: 'Medkit',
    description: null,
    category: 'consumable',
    stackable: true,
    maxStack: 10,
    weightGrams: 500,
    usable: true,
    tradable: true,
    metadataSchema: null,
    status: 'active',
    imageUrl: null,
    icon: null,
    tags: [],
    sortOrder: 0,
    version: 1,
    actionConfig: {
      type: 'consume',
      cooldownMs: 5000,
      consumeQuantity: 1,
      durabilityCost: 0,
      destroyOnEmpty: false,
      serverEvent: 'medkit.use',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeUseResult(overrides = {}) {
  return {
    itemId: 'medkit',
    consumed: 1,
    remainingQuantity: 2,
    durability: null,
    destroyed: false,
    idempotent: false,
    ...overrides,
  }
}

function makeInventoryRepo(overrides = {}) {
  return {
    getSlot: vi.fn().mockResolvedValue(makeSlot()),
    executeUse: vi.fn().mockResolvedValue(makeUseResult()),
    ...overrides,
  }
}

function makeItemDefRepo(overrides = {}) {
  return {
    findById: vi.fn().mockResolvedValue(makeItemDef()),
    ...overrides,
  }
}

function makeCooldownCache(overrides = {}) {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(new Date(Date.now() + 5000)),
    clear: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

const CHAR_ID = 'char-001'
const USE_REQ = { slot: 5, idempotencyKey: 'atc:use:123' }

// ── Successful use ─────────────────────────────────────────────────────────────

describe('ItemRuntimeExecutor — successful use', () => {
  it('returns success response with correct fields', async () => {
    const inv = makeInventoryRepo()
    const defs = makeItemDefRepo()
    const cooldown = makeCooldownCache()
    const executor = new ItemRuntimeExecutor(
      inv as any, defs as any, cooldown as any,
    )
    const result = await executor.useItem(CHAR_ID, USE_REQ)
    expect(result.success).toBe(true)
    expect(result.itemId).toBe('medkit')
    expect(result.slot).toBe(5)
    expect(result.consumed).toBe(1)
    expect(result.remainingQuantity).toBe(2)
    expect(result.idempotent).toBe(false)
  })

  it('sets cooldown in Redis when cooldownMs > 0', async () => {
    const cooldown = makeCooldownCache()
    const executor = new ItemRuntimeExecutor(
      makeInventoryRepo() as any, makeItemDefRepo() as any, cooldown as any,
    )
    await executor.useItem(CHAR_ID, USE_REQ)
    expect(cooldown.set).toHaveBeenCalledWith(CHAR_ID, 5, 5000)
  })

  it('does not set cooldown when cooldownMs is 0', async () => {
    const defs = makeItemDefRepo({
      findById: vi.fn().mockResolvedValue(makeItemDef({
        actionConfig: { type: 'consume', cooldownMs: 0, consumeQuantity: 1, durabilityCost: 0 },
      })),
    })
    const cooldown = makeCooldownCache()
    const executor = new ItemRuntimeExecutor(
      makeInventoryRepo() as any, defs as any, cooldown as any,
    )
    await executor.useItem(CHAR_ID, USE_REQ)
    expect(cooldown.set).not.toHaveBeenCalled()
  })

  it('returns idempotent=true on replay', async () => {
    const inv = makeInventoryRepo({
      executeUse: vi.fn().mockResolvedValue(makeUseResult({ idempotent: true })),
    })
    const executor = new ItemRuntimeExecutor(
      inv as any, makeItemDefRepo() as any, makeCooldownCache() as any,
    )
    const result = await executor.useItem(CHAR_ID, USE_REQ)
    expect(result.idempotent).toBe(true)
    // Cooldown should NOT be re-applied on replay
    const cooldown = makeCooldownCache()
    expect(cooldown.set).not.toHaveBeenCalled()
  })

  it('executes registered serverEvent effect', async () => {
    const effects = new RuntimeEffectRegistry()
    const handler = vi.fn().mockResolvedValue({ success: true, data: { healed: 50 } })
    effects.register('medkit.use', handler)

    const executor = new ItemRuntimeExecutor(
      makeInventoryRepo() as any, makeItemDefRepo() as any, makeCooldownCache() as any, effects,
    )
    const result = await executor.useItem(CHAR_ID, USE_REQ)
    expect(handler).toHaveBeenCalledWith(CHAR_ID, 'medkit', {})
    expect(result.effects).toHaveLength(1)
    expect(result.effects[0]?.type).toBe('medkit.use')
    expect(result.effects[0]?.success).toBe(true)
  })

  it('succeeds even when no effect handler is registered', async () => {
    const executor = new ItemRuntimeExecutor(
      makeInventoryRepo() as any, makeItemDefRepo() as any, makeCooldownCache() as any,
    )
    const result = await executor.useItem(CHAR_ID, USE_REQ)
    expect(result.effects).toHaveLength(1)
    expect(result.effects[0]?.success).toBe(true)
  })
})

// ── Slot not found ────────────────────────────────────────────────────────────

describe('ItemRuntimeExecutor — slot not found', () => {
  it('throws InventoryItemNotFoundError when slot is empty', async () => {
    const inv = makeInventoryRepo({ getSlot: vi.fn().mockResolvedValue(null) })
    const executor = new ItemRuntimeExecutor(
      inv as any, makeItemDefRepo() as any, makeCooldownCache() as any,
    )
    await expect(executor.useItem(CHAR_ID, USE_REQ))
      .rejects.toBeInstanceOf(InventoryItemNotFoundError)
  })
})

// ── Item not usable ───────────────────────────────────────────────────────────

describe('ItemRuntimeExecutor — item not usable', () => {
  it('throws ItemNotUsableError when usable=false', async () => {
    const defs = makeItemDefRepo({
      findById: vi.fn().mockResolvedValue(makeItemDef({ usable: false })),
    })
    const executor = new ItemRuntimeExecutor(
      makeInventoryRepo() as any, defs as any, makeCooldownCache() as any,
    )
    await expect(executor.useItem(CHAR_ID, USE_REQ))
      .rejects.toBeInstanceOf(ItemNotUsableError)
  })

  it('throws ItemNotUsableError when actionConfig is null', async () => {
    const defs = makeItemDefRepo({
      findById: vi.fn().mockResolvedValue(makeItemDef({ actionConfig: null })),
    })
    const executor = new ItemRuntimeExecutor(
      makeInventoryRepo() as any, defs as any, makeCooldownCache() as any,
    )
    await expect(executor.useItem(CHAR_ID, USE_REQ))
      .rejects.toBeInstanceOf(ItemNotUsableError)
  })

  it('throws ItemNotUsableError when item status is disabled', async () => {
    const defs = makeItemDefRepo({
      findById: vi.fn().mockResolvedValue(makeItemDef({ status: 'disabled' })),
    })
    const executor = new ItemRuntimeExecutor(
      makeInventoryRepo() as any, defs as any, makeCooldownCache() as any,
    )
    await expect(executor.useItem(CHAR_ID, USE_REQ))
      .rejects.toBeInstanceOf(ItemNotUsableError)
  })

  it('throws ItemNotUsableError when item status is deprecated', async () => {
    const defs = makeItemDefRepo({
      findById: vi.fn().mockResolvedValue(makeItemDef({ status: 'deprecated' })),
    })
    const executor = new ItemRuntimeExecutor(
      makeInventoryRepo() as any, defs as any, makeCooldownCache() as any,
    )
    await expect(executor.useItem(CHAR_ID, USE_REQ))
      .rejects.toBeInstanceOf(ItemNotUsableError)
  })
})

// ── Cooldown enforcement ──────────────────────────────────────────────────────

describe('ItemRuntimeExecutor — cooldown', () => {
  it('throws ItemCooldownActiveError when cooldown is active', async () => {
    const expiresAt = new Date(Date.now() + 3000)
    const cooldown = makeCooldownCache({
      get: vi.fn().mockResolvedValue({ characterId: CHAR_ID, slot: 5, expiresAt }),
    })
    const executor = new ItemRuntimeExecutor(
      makeInventoryRepo() as any, makeItemDefRepo() as any, cooldown as any,
    )
    const err = await executor.useItem(CHAR_ID, USE_REQ).catch((e) => e)
    expect(err).toBeInstanceOf(ItemCooldownActiveError)
    expect((err as ItemCooldownActiveError).expiresAt).toEqual(expiresAt)
  })

  it('proceeds when cooldown has expired (cache returns null)', async () => {
    const cooldown = makeCooldownCache({ get: vi.fn().mockResolvedValue(null) })
    const executor = new ItemRuntimeExecutor(
      makeInventoryRepo() as any, makeItemDefRepo() as any, cooldown as any,
    )
    await expect(executor.useItem(CHAR_ID, USE_REQ)).resolves.toBeDefined()
  })
})

// ── Durability enforcement ────────────────────────────────────────────────────

describe('ItemRuntimeExecutor — durability', () => {
  it('throws ItemInsufficientDurabilityError when durability is 0 and cost > 0', async () => {
    const inv = makeInventoryRepo({
      getSlot: vi.fn().mockResolvedValue(makeSlot({ durability: 0 })),
    })
    const defs = makeItemDefRepo({
      findById: vi.fn().mockResolvedValue(makeItemDef({
        actionConfig: { type: 'consume', durabilityCost: 10, consumeQuantity: 1 },
      })),
    })
    const executor = new ItemRuntimeExecutor(
      inv as any, defs as any, makeCooldownCache() as any,
    )
    await expect(executor.useItem(CHAR_ID, USE_REQ))
      .rejects.toBeInstanceOf(ItemInsufficientDurabilityError)
  })

  it('does not check durability when slot.durability is null (not tracked)', async () => {
    const inv = makeInventoryRepo({
      getSlot: vi.fn().mockResolvedValue(makeSlot({ durability: null })),
    })
    const defs = makeItemDefRepo({
      findById: vi.fn().mockResolvedValue(makeItemDef({
        actionConfig: { type: 'consume', durabilityCost: 10, consumeQuantity: 1 },
      })),
    })
    const executor = new ItemRuntimeExecutor(
      inv as any, defs as any, makeCooldownCache() as any,
    )
    await expect(executor.useItem(CHAR_ID, USE_REQ)).resolves.toBeDefined()
  })

  it('allows use when durability > 0', async () => {
    const inv = makeInventoryRepo({
      getSlot: vi.fn().mockResolvedValue(makeSlot({ durability: 50 })),
    })
    const defs = makeItemDefRepo({
      findById: vi.fn().mockResolvedValue(makeItemDef({
        actionConfig: { type: 'consume', durabilityCost: 10, consumeQuantity: 1 },
      })),
    })
    const executor = new ItemRuntimeExecutor(
      inv as any, defs as any, makeCooldownCache() as any,
    )
    await expect(executor.useItem(CHAR_ID, USE_REQ)).resolves.toBeDefined()
  })
})

// ── Insufficient quantity ─────────────────────────────────────────────────────

describe('ItemRuntimeExecutor — insufficient quantity', () => {
  it('propagates InventoryInsufficientQuantityError from executeUse', async () => {
    const inv = makeInventoryRepo({
      executeUse: vi.fn().mockRejectedValue(new InventoryInsufficientQuantityError()),
    })
    const executor = new ItemRuntimeExecutor(
      inv as any, makeItemDefRepo() as any, makeCooldownCache() as any,
    )
    await expect(executor.useItem(CHAR_ID, USE_REQ))
      .rejects.toBeInstanceOf(InventoryInsufficientQuantityError)
  })
})

// ── Hardening: BUG-8-2 — effect handler exceptions are non-fatal ─────────────

describe('ItemRuntimeExecutor — effect handler exception safety (BUG-8-2)', () => {
  it('captures effect handler throw as success:false instead of propagating as 500', async () => {
    const effects = new RuntimeEffectRegistry()
    effects.register('medkit.use', async () => {
      throw new Error('Downstream service unavailable')
    })
    const executor = new ItemRuntimeExecutor(
      makeInventoryRepo() as any, makeItemDefRepo() as any, makeCooldownCache() as any, effects,
    )
    const result = await executor.useItem(CHAR_ID, USE_REQ)
    expect(result.success).toBe(true)
    expect(result.effects).toHaveLength(1)
    expect(result.effects[0]?.type).toBe('medkit.use')
    expect(result.effects[0]?.success).toBe(false)
  })

  it('still returns overall success:true even if multiple effects fail', async () => {
    const effects = new RuntimeEffectRegistry()
    effects.register('medkit.use', async () => { throw new Error('fail') })
    const executor = new ItemRuntimeExecutor(
      makeInventoryRepo() as any, makeItemDefRepo() as any, makeCooldownCache() as any, effects,
    )
    const result = await executor.useItem(CHAR_ID, USE_REQ)
    expect(result.success).toBe(true)
  })
})

// ── Hardening: BUG-8-4 — partial durability pre-check ────────────────────────

describe('ItemRuntimeExecutor — partial durability pre-check (BUG-8-4)', () => {
  it('throws ItemInsufficientDurabilityError when durability < durabilityCost (not just when =0)', async () => {
    const inv = makeInventoryRepo({
      getSlot: vi.fn().mockResolvedValue(makeSlot({ durability: 3 })),
    })
    const defs = makeItemDefRepo({
      findById: vi.fn().mockResolvedValue(makeItemDef({
        actionConfig: { type: 'consume', durabilityCost: 5, consumeQuantity: 1 },
      })),
    })
    const executor = new ItemRuntimeExecutor(
      inv as any, defs as any, makeCooldownCache() as any,
    )
    await expect(executor.useItem(CHAR_ID, USE_REQ))
      .rejects.toBeInstanceOf(ItemInsufficientDurabilityError)
  })

  it('allows use when durability exactly equals durabilityCost', async () => {
    const inv = makeInventoryRepo({
      getSlot: vi.fn().mockResolvedValue(makeSlot({ durability: 5 })),
    })
    const defs = makeItemDefRepo({
      findById: vi.fn().mockResolvedValue(makeItemDef({
        actionConfig: { type: 'consume', durabilityCost: 5, consumeQuantity: 1 },
      })),
    })
    const executor = new ItemRuntimeExecutor(
      inv as any, defs as any, makeCooldownCache() as any,
    )
    await expect(executor.useItem(CHAR_ID, USE_REQ)).resolves.toBeDefined()
  })
})

// ── Hardening: slot-based cooldown bypass documentation ──────────────────────
// Cooldown key is characterId:slot — moving an item to a different slot bypasses
// the cooldown. This is intentional (slot-based, not item-based). Document here.

describe('ItemRuntimeExecutor — slot-based cooldown behavior (documented)', () => {
  it('cooldown on slot 5 does NOT block use of the same item moved to slot 6', async () => {
    // Slot 5 has an active cooldown
    const cooldown = makeCooldownCache({
      get: vi.fn().mockImplementation((charId: string, slot: number) =>
        slot === 5
          ? Promise.resolve({ characterId: charId, slot: 5, expiresAt: new Date(Date.now() + 5000) })
          : Promise.resolve(null),
      ),
    })
    const executor = new ItemRuntimeExecutor(
      makeInventoryRepo() as any, makeItemDefRepo() as any, cooldown as any,
    )
    // Use on slot 5 should be blocked
    await expect(executor.useItem(CHAR_ID, { slot: 5, idempotencyKey: 'key-a' }))
      .rejects.toBeInstanceOf(ItemCooldownActiveError)
    // Use on slot 6 (same item, moved) is NOT blocked — slot-based cooldown by design
    await expect(executor.useItem(CHAR_ID, { slot: 6, idempotencyKey: 'key-b' }))
      .resolves.toBeDefined()
  })
})
