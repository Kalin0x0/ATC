import { describe, it, expect, vi } from 'vitest'
import { createVitalsModifyHandler, ItemRuntimeExecutor, ItemCooldownCache, RuntimeEffectRegistry } from '@atc/runtime-items'
import { InventoryItemNotFoundError } from '@atc/db'
import type { AtcItemDefinition, AtcInventorySlot } from '@atc/shared-types'

// ── createVitalsModifyHandler ─────────────────────────────────────────────────

describe('createVitalsModifyHandler', () => {
  const CHAR_ID = 'char-001'

  function makeService(rejects = false) {
    return {
      mutate: rejects
        ? vi.fn().mockRejectedValue(new Error('DB error'))
        : vi.fn().mockResolvedValue({ characterId: CHAR_ID, health: 75 }),
    }
  }

  it('calls mutate with correct vital/mode/amount and returns success:true', async () => {
    const service = makeService()
    const handler = createVitalsModifyHandler(service)
    const result = await handler(CHAR_ID, 'water_bottle', {
      type: 'vitals.modify',
      vital: 'thirst',
      mode: 'increment',
      amount: 25,
    })
    expect(service.mutate).toHaveBeenCalledWith(CHAR_ID, 'thirst', 'increment', 25)
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ vital: 'thirst', mode: 'increment', amount: 25 })
  })

  it('returns success:false when mutate throws — effect is non-fatal', async () => {
    const service = makeService(true)
    const handler = createVitalsModifyHandler(service)
    const result = await handler(CHAR_ID, 'water_bottle', {
      type: 'vitals.modify',
      vital: 'hunger',
      mode: 'increment',
      amount: 20,
    })
    expect(result.success).toBe(false)
    expect(result.data).toBeUndefined()
  })

  it('returns success:false when data is missing vital/mode/amount', async () => {
    const service = makeService()
    const handler = createVitalsModifyHandler(service)
    const result = await handler(CHAR_ID, 'water_bottle', {})
    expect(result.success).toBe(false)
    expect(service.mutate).not.toHaveBeenCalled()
  })
})

// ── ItemRuntimeExecutor with vitals.modify effect ─────────────────────────────

describe('ItemRuntimeExecutor — vitals.modify effect integration', () => {
  const CHAR_ID = 'char-001'
  const SLOT = 3

  function makeSlot(overrides: Partial<AtcInventorySlot> = {}): AtcInventorySlot {
    return {
      id: 'slot-001',
      characterId: CHAR_ID,
      itemId: 'water_bottle',
      slot: SLOT,
      quantity: 5,
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
      id: 'water_bottle',
      label: 'Water Bottle',
      description: null,
      category: 'consumable',
      stackable: true,
      maxStack: 20,
      weightGrams: 200,
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
        cooldownMs: 3000,
        consumeQuantity: 1,
        destroyOnEmpty: false,
        effects: [
          { type: 'vitals.modify', vital: 'thirst', mode: 'increment', amount: 25 },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  function makeInventoryRepo() {
    return {
      getSlot: vi.fn().mockResolvedValue(makeSlot()),
      executeUse: vi.fn().mockResolvedValue({
        itemId: 'water_bottle', consumed: 1, remainingQuantity: 4,
        durability: null, destroyed: false, idempotent: false,
      }),
    }
  }

  function makeItemDefsRepo(def = makeItemDef()) {
    return { findById: vi.fn().mockResolvedValue(def) }
  }

  function makeCooldown() {
    return {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(new Date(Date.now() + 3000)),
    }
  }

  it('vitals.modify effect succeeds — item use response has success:true and effect success:true', async () => {
    const mutate = vi.fn().mockResolvedValue({ characterId: CHAR_ID, thirst: 85 })
    const vitalsService = { mutate }

    const effects = new RuntimeEffectRegistry()
    effects.register('vitals.modify', createVitalsModifyHandler(vitalsService))

    const executor = new ItemRuntimeExecutor(
      makeInventoryRepo() as never,
      makeItemDefsRepo() as never,
      makeCooldown() as never,
      effects,
    )

    const result = await executor.useItem(CHAR_ID, { slot: SLOT, idempotencyKey: 'key-001' })
    expect(result.success).toBe(true)
    expect(result.effects).toHaveLength(1)
    expect(result.effects[0].type).toBe('vitals.modify')
    expect(result.effects[0].success).toBe(true)
    expect(mutate).toHaveBeenCalledWith(CHAR_ID, 'thirst', 'increment', 25)
  })

  it('vitals.modify effect fails — item use still succeeds (non-fatal effect)', async () => {
    const vitalsService = {
      mutate: vi.fn().mockRejectedValue(new Error('Vitals DB down')),
    }

    const effects = new RuntimeEffectRegistry()
    effects.register('vitals.modify', createVitalsModifyHandler(vitalsService))

    const executor = new ItemRuntimeExecutor(
      makeInventoryRepo() as never,
      makeItemDefsRepo() as never,
      makeCooldown() as never,
      effects,
    )

    const result = await executor.useItem(CHAR_ID, { slot: SLOT, idempotencyKey: 'key-002' })
    expect(result.success).toBe(true)
    expect(result.effects[0].success).toBe(false)
  })

  it('item use returns success:true with no effects array entry when no effect registered', async () => {
    const effects = new RuntimeEffectRegistry()

    const executor = new ItemRuntimeExecutor(
      makeInventoryRepo() as never,
      makeItemDefsRepo() as never,
      makeCooldown() as never,
      effects,
    )

    const result = await executor.useItem(CHAR_ID, { slot: SLOT, idempotencyKey: 'key-003' })
    // vitals.modify type fires, no handler registered — succeeds silently
    expect(result.success).toBe(true)
    expect(result.effects[0].success).toBe(true)
  })
})
