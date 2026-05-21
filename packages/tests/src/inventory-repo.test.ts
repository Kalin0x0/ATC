import { describe, it, expect, vi } from 'vitest'
import {
  InventoryRepository,
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
} from '@atc/db'

// ── Mock factories ────────────────────────────────────────────────────────────

function makeConn(overrides: Record<string, unknown> = {}) {
  return {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit:           vi.fn().mockResolvedValue(undefined),
    rollback:         vi.fn().mockResolvedValue(undefined),
    release:          vi.fn(),
    execute:          vi.fn(),
    ...overrides,
  }
}

/**
 * Pool with execute only (for calculateWeight / getOrCreateSettings / updateSettings tests).
 */
function makePoolWithExecute(executeFn: ReturnType<typeof vi.fn>) {
  return { execute: executeFn } as unknown as ConstructorParameters<typeof InventoryRepository>[0]
}

/**
 * Pool with BOTH execute (for getOrCreateSettings/settings calls) AND getConnection
 * (for transaction calls inside addItem / moveItem).
 */
function makeFullPool(
  poolExFn: ReturnType<typeof vi.fn>,
  conn: ReturnType<typeof makeConn>,
) {
  return {
    execute: poolExFn,
    getConnection: vi.fn().mockResolvedValue(conn),
  } as unknown as ConstructorParameters<typeof InventoryRepository>[0]
}

const CHAR_ID = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'

/**
 * Returns a mock pool.execute that routes by query content:
 * - INSERT INTO atc_character_inventory_settings → [[]] (ignored)
 * - SELECT * FROM atc_character_inventory_settings → [[settingsRow]]
 * Accepts optional settings overrides for maxSlots / maxWeightGrams.
 */
function makeSettingsPoolExec(overrides: { maxSlots?: number; maxWeightGrams?: number } = {}) {
  const row = {
    character_id: CHAR_ID,
    max_slots: overrides.maxSlots ?? 60,
    max_weight_grams: overrides.maxWeightGrams ?? 30_000,
    created_at: new Date(),
    updated_at: new Date(),
  }
  return vi.fn().mockImplementation((query: string) => {
    if (String(query).includes('INSERT INTO atc_character_inventory_settings')) {
      return Promise.resolve([[]])
    }
    return Promise.resolve([[row]])
  })
}

// ── calculateWeight ───────────────────────────────────────────────────────────
// calculateWeight calls Promise.all([getOrCreateSettings, _totalWeightGrams]).
// Execution order of pool.execute:
//   call 1 → INSERT settings (getOrCreateSettings step 1)
//   call 2 → SUM weight (_totalWeightGrams, starts concurrently)
//   call 3 → SELECT settings (getOrCreateSettings step 2, after INSERT resolves)
// We use query-sniffing to avoid order fragility.

describe('InventoryRepository — calculateWeight', () => {
  function makeWeightPool(totalWeightStr: string | null) {
    const settingsRow = {
      character_id: CHAR_ID,
      max_slots: 60,
      max_weight_grams: 30_000,
      created_at: new Date(),
      updated_at: new Date(),
    }
    return makePoolWithExecute(vi.fn().mockImplementation((query: string) => {
      if (String(query).includes('INSERT INTO atc_character_inventory_settings')) {
        return Promise.resolve([[]])
      }
      if (String(query).includes('SELECT * FROM atc_character_inventory_settings')) {
        return Promise.resolve([[settingsRow]])
      }
      // SUM weight query
      return Promise.resolve([[{ total_weight_grams: totalWeightStr }]])
    }))
  }

  it('returns 0 weight for empty inventory', async () => {
    const repo = new InventoryRepository(makeWeightPool(null))
    const weight = await repo.calculateWeight(CHAR_ID)
    expect(weight.totalWeightGrams).toBe(0)
    expect(weight.maxWeightGrams).toBe(30_000)
    expect(weight.isOverweight).toBe(false)
    expect(weight.remainingWeightGrams).toBe(30_000)
  })

  it('reports overweight when total exceeds maxWeightGrams', async () => {
    const repo = new InventoryRepository(makeWeightPool('35000'))
    const weight = await repo.calculateWeight(CHAR_ID)
    expect(weight.totalWeightGrams).toBe(35_000)
    expect(weight.isOverweight).toBe(true)
    expect(weight.remainingWeightGrams).toBe(0)
  })

  it('reports not overweight at exactly maxWeightGrams', async () => {
    const repo = new InventoryRepository(makeWeightPool('30000'))
    const weight = await repo.calculateWeight(CHAR_ID)
    expect(weight.isOverweight).toBe(false)
    expect(weight.remainingWeightGrams).toBe(0)
  })
})

// ── addItem — idempotency ─────────────────────────────────────────────────────

describe('InventoryRepository — addItem idempotency', () => {
  const BASE_PARAMS = {
    characterId: CHAR_ID,
    itemId: 'water_bottle',
    quantity: 1,
    reason: 'test',
    source: 'system' as const,
    idempotencyKey: 'key-001',
  }

  function existingTxRow(payloadHash: string | null = null) {
    return {
      id: 'TX000000000000000000000001',
      character_id: CHAR_ID,
      type: 'add',
      item_id: 'water_bottle',
      slot_from: null,
      slot_to: 1,
      quantity: 1,
      reason: 'test',
      source: 'system',
      idempotency_key: 'key-001',
      payload_hash: payloadHash,
      metadata_json: null,
      created_at: new Date(),
    }
  }

  it('returns idempotent result when key already exists', async () => {
    const txRow = existingTxRow(null)
    const conn = makeConn({
      execute: vi.fn().mockResolvedValueOnce([[txRow]])  // idempotency SELECT
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    const result = await repo.addItem(BASE_PARAMS)
    expect(result.idempotent).toBe(true)
    expect(conn.rollback).toHaveBeenCalled()
    expect(conn.commit).not.toHaveBeenCalled()
  })

  it('throws InventoryIdempotencyPayloadMismatchError on hash mismatch', async () => {
    const txRow = existingTxRow('different-hash')
    const conn = makeConn({
      execute: vi.fn().mockResolvedValueOnce([[txRow]])  // idempotency SELECT
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    await expect(repo.addItem(BASE_PARAMS)).rejects.toBeInstanceOf(InventoryIdempotencyPayloadMismatchError)
  })

  it('skips hash check when existing tx has null hash', async () => {
    const txRow = existingTxRow(null)
    const conn = makeConn({
      execute: vi.fn().mockResolvedValueOnce([[txRow]])  // idempotency SELECT
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    const result = await repo.addItem(BASE_PARAMS)
    expect(result.idempotent).toBe(true)
  })
})

// ── addItem — item validation ─────────────────────────────────────────────────

describe('InventoryRepository — addItem item validation', () => {
  const BASE_PARAMS = {
    characterId: CHAR_ID,
    itemId: 'water_bottle',
    quantity: 1,
    reason: 'test',
    source: 'system' as const,
    idempotencyKey: 'key-002',
  }

  it('throws InventoryItemNotFoundError when item not found', async () => {
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])  // no existing tx
        .mockResolvedValueOnce([[]])  // item definition not found
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    await expect(repo.addItem(BASE_PARAMS)).rejects.toBeInstanceOf(InventoryItemNotFoundError)
    expect(conn.rollback).toHaveBeenCalled()
  })

  it('throws InventoryItemNotFoundError when item status is disabled', async () => {
    const itemRow = { stackable: 1, max_stack: 10, weight_grams: 0, status: 'disabled', metadata_schema_json: null }
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])        // no existing tx
        .mockResolvedValueOnce([[itemRow]]) // disabled item
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    await expect(repo.addItem(BASE_PARAMS)).rejects.toBeInstanceOf(InventoryItemNotFoundError)
  })
})

// ── addItem — slot occupancy ──────────────────────────────────────────────────

describe('InventoryRepository — addItem slot conflicts', () => {
  it('throws InventorySlotOccupiedError when requested slot is taken', async () => {
    const itemRow = { stackable: 0, max_stack: 1, weight_grams: 0, status: 'active', metadata_schema_json: null }
    const occupiedSlotRow = { id: 'other', character_id: CHAR_ID, item_id: 'bread', slot: 5, quantity: 1, metadata_json: null, created_at: new Date(), updated_at: new Date() }
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])           // no existing tx
        .mockResolvedValueOnce([[itemRow]])    // item found + active
        .mockResolvedValueOnce([[{ total_weight_grams: null }]])  // weight SUM (0g, within limit)
        .mockResolvedValueOnce([[occupiedSlotRow]])  // slot is occupied
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    await expect(repo.addItem({
      characterId: CHAR_ID,
      itemId: 'water_bottle',
      quantity: 1,
      slot: 5,
      reason: 'test',
      source: 'system',
      idempotencyKey: 'key-003',
    })).rejects.toBeInstanceOf(InventorySlotOccupiedError)
  })

  it('throws InventoryFullError when all maxSlots slots are occupied (default 60)', async () => {
    const itemRow = { stackable: 0, max_stack: 1, weight_grams: 0, status: 'active', metadata_schema_json: null }
    // Default maxSlots = 60; fill 60 slots
    const allSlots = Array.from({ length: 60 }, (_, i) => ({ slot: i + 1 }))
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])        // no existing tx
        .mockResolvedValueOnce([[itemRow]]) // item found
        .mockResolvedValueOnce([[{ total_weight_grams: null }]])  // weight SUM
        .mockResolvedValueOnce([allSlots])  // all 60 slots occupied (stackable=0 so no merge attempt)
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    await expect(repo.addItem({
      characterId: CHAR_ID,
      itemId: 'water_bottle',
      quantity: 1,
      reason: 'test',
      source: 'system',
      idempotencyKey: 'key-004',
    })).rejects.toBeInstanceOf(InventoryFullError)
  })
})

// ── removeItem — insufficient quantity ───────────────────────────────────────

describe('InventoryRepository — removeItem', () => {
  it('throws InventoryInsufficientQuantityError when item not in inventory', async () => {
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])  // no existing tx
        .mockResolvedValueOnce([[]])  // item not found in inventory
    })
    // removeItem does NOT call getOrCreateSettings — use a pool-only mock without execute
    const pool = { getConnection: vi.fn().mockResolvedValue(conn) } as unknown as ConstructorParameters<typeof InventoryRepository>[0]
    const repo = new InventoryRepository(pool)
    await expect(repo.removeItem({
      characterId: CHAR_ID,
      itemId: 'water_bottle',
      quantity: 1,
      reason: 'test',
      source: 'system',
      idempotencyKey: 'key-005',
    })).rejects.toBeInstanceOf(InventoryInsufficientQuantityError)
  })

  it('throws InventoryInsufficientQuantityError when quantity exceeds slot', async () => {
    const slotRow = { id: 'slot1', character_id: CHAR_ID, item_id: 'water_bottle', slot: 1, quantity: 2, metadata_json: null, created_at: new Date(), updated_at: new Date() }
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])       // no existing tx
        .mockResolvedValueOnce([[slotRow]]) // slot found but only 2
    })
    const pool = { getConnection: vi.fn().mockResolvedValue(conn) } as unknown as ConstructorParameters<typeof InventoryRepository>[0]
    const repo = new InventoryRepository(pool)
    await expect(repo.removeItem({
      characterId: CHAR_ID,
      itemId: 'water_bottle',
      quantity: 5,
      reason: 'test',
      source: 'system',
      idempotencyKey: 'key-006',
    })).rejects.toBeInstanceOf(InventoryInsufficientQuantityError)
  })
})

// ── moveItem ──────────────────────────────────────────────────────────────────

describe('InventoryRepository — moveItem', () => {
  it('throws InventoryInsufficientQuantityError when source slot is empty', async () => {
    // Deadlock-safe impl locks both slots (low first, then high) before checking fromRow.
    // fromSlot=1 < toSlot=5 → lowSlot=1, highSlot=5
    // After idempotency check + toSlot capacity check (ok), locks slot 1 then slot 5.
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])  // no existing tx
        .mockResolvedValueOnce([[]])  // lock slot 1 (lowSlot = fromSlot) — empty
        .mockResolvedValueOnce([[]])  // lock slot 5 (highSlot = toSlot) — empty
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    await expect(repo.moveItem({
      characterId: CHAR_ID,
      fromSlot: 1,
      toSlot: 5,
      idempotencyKey: 'key-007',
    })).rejects.toBeInstanceOf(InventoryInsufficientQuantityError)
  })

  it('throws InventoryIdempotencyPayloadMismatchError on hash mismatch', async () => {
    const txRow = {
      id: 'TX000000000000000000000002',
      character_id: CHAR_ID,
      type: 'move',
      item_id: 'water_bottle',
      slot_from: 1,
      slot_to: 5,
      quantity: 1,
      reason: 'slot move',
      source: 'api',
      idempotency_key: 'key-008',
      payload_hash: 'bad-hash',
      metadata_json: null,
      created_at: new Date(),
    }
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[txRow]])  // existing tx with bad hash
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    await expect(repo.moveItem({
      characterId: CHAR_ID,
      fromSlot: 1,
      toSlot: 5,
      idempotencyKey: 'key-008',
    })).rejects.toBeInstanceOf(InventoryIdempotencyPayloadMismatchError)
  })

  it('throws InventoryInsufficientQuantityError on partial move to occupied slot (BUG-8)', async () => {
    const fromRow = { id: 'from1', character_id: CHAR_ID, item_id: 'water_bottle', slot: 1, quantity: 10, metadata_json: null, created_at: new Date(), updated_at: new Date() }
    const toRow   = { id: 'to1',   character_id: CHAR_ID, item_id: 'bread',        slot: 5, quantity:  3, metadata_json: null, created_at: new Date(), updated_at: new Date() }
    // fromSlot=1 < toSlot=5 → locks lowSlot=1 first, then highSlot=5
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])       // no existing tx
        .mockResolvedValueOnce([[fromRow]])  // lock slot 1 (low)
        .mockResolvedValueOnce([[toRow]])    // lock slot 5 (high)
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    await expect(repo.moveItem({
      characterId: CHAR_ID,
      fromSlot: 1,
      toSlot: 5,
      quantity: 5,  // partial → cannot do partial move to occupied slot with different item
      idempotencyKey: 'key-009',
    })).rejects.toBeInstanceOf(InventoryInsufficientQuantityError)
  })
})

// ── addItem — stack limit enforcement (BUG-1) ─────────────────────────────────

describe('InventoryRepository — addItem stack limit (BUG-1)', () => {
  it('throws InventoryStackLimitError when quantity exceeds item maxStack', async () => {
    const itemRow = { stackable: 1, max_stack: 5, weight_grams: 0, status: 'active', metadata_schema_json: null }
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])        // no existing tx
        .mockResolvedValueOnce([[itemRow]]) // item found with maxStack=5
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    await expect(repo.addItem({
      characterId: CHAR_ID,
      itemId: 'water_bottle',
      quantity: 10,  // exceeds maxStack of 5
      reason: 'test',
      source: 'system',
      idempotencyKey: 'key-010',
    })).rejects.toBeInstanceOf(InventoryStackLimitError)
    expect(conn.rollback).toHaveBeenCalled()
  })

  it('throws InventoryStackLimitError for non-stackable item with quantity > 1 (BUG-1)', async () => {
    const itemRow = { stackable: 0, max_stack: 1, weight_grams: 0, status: 'active', metadata_schema_json: null }
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])        // no existing tx
        .mockResolvedValueOnce([[itemRow]]) // non-stackable item (maxStack=1)
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    await expect(repo.addItem({
      characterId: CHAR_ID,
      itemId: 'unique_weapon',
      quantity: 2,  // non-stackable must be 1
      reason: 'test',
      source: 'system',
      idempotencyKey: 'key-011',
    })).rejects.toBeInstanceOf(InventoryStackLimitError)
  })
})

// ── addItem — ER_DUP_ENTRY race (BUG-2) ──────────────────────────────────────

describe('InventoryRepository — addItem concurrent slot race (BUG-2)', () => {
  it('converts ER_DUP_ENTRY to InventorySlotOccupiedError instead of crashing', async () => {
    const itemRow = { stackable: 0, max_stack: 1, weight_grams: 0, status: 'active', metadata_schema_json: null }
    const dupError = Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' })
    // Non-stackable, specific slot provided: no merge attempt → straight to slot check
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])         // no existing tx
        .mockResolvedValueOnce([[itemRow]])  // item found
        .mockResolvedValueOnce([[{ total_weight_grams: null }]])  // weight SUM
        .mockResolvedValueOnce([[]])         // slot check returns empty (looked free)
        .mockRejectedValueOnce(dupError)     // INSERT races → ER_DUP_ENTRY
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    await expect(repo.addItem({
      characterId: CHAR_ID,
      itemId: 'unique_weapon',
      quantity: 1,
      slot: 7,
      reason: 'test',
      source: 'system',
      idempotencyKey: 'key-012',
    })).rejects.toBeInstanceOf(InventorySlotOccupiedError)
  })
})

// ── calculateWeight — safe-integer overflow guard (BUG-9) ────────────────────

describe('InventoryRepository — calculateWeight overflow (BUG-9)', () => {
  it('throws when weight sum exceeds Number.MAX_SAFE_INTEGER', async () => {
    const unsafe = (Number.MAX_SAFE_INTEGER + 1).toString()
    const settingsRow = { character_id: CHAR_ID, max_slots: 60, max_weight_grams: 30_000, created_at: new Date(), updated_at: new Date() }
    const pool = makePoolWithExecute(vi.fn().mockImplementation((query: string) => {
      if (String(query).includes('INSERT INTO atc_character_inventory_settings')) {
        return Promise.resolve([[]])
      }
      if (String(query).includes('SELECT * FROM atc_character_inventory_settings')) {
        return Promise.resolve([[settingsRow]])
      }
      return Promise.resolve([[{ total_weight_grams: unsafe }]])
    }))
    const repo = new InventoryRepository(pool)
    await expect(repo.calculateWeight(CHAR_ID)).rejects.toThrow(/Weight integrity/)
  })
})

// ── Phase 6: getOrCreateSettings ─────────────────────────────────────────────

describe('InventoryRepository — getOrCreateSettings', () => {
  it('creates and returns default settings on first call', async () => {
    const settingsRow = {
      character_id: CHAR_ID,
      max_slots: 60,
      max_weight_grams: 30_000,
      created_at: new Date(),
      updated_at: new Date(),
    }
    const pool = makePoolWithExecute(vi.fn()
      .mockResolvedValueOnce([[]])              // INSERT ON DUPLICATE KEY UPDATE
      .mockResolvedValueOnce([[settingsRow]])   // SELECT
    )
    const repo = new InventoryRepository(pool)
    const result = await repo.getOrCreateSettings(CHAR_ID)
    expect(result.characterId).toBe(CHAR_ID)
    expect(result.maxSlots).toBe(60)
    expect(result.maxWeightGrams).toBe(30_000)
  })
})

// ── Phase 6: updateSettings ───────────────────────────────────────────────────

describe('InventoryRepository — updateSettings', () => {
  it('updates maxSlots when no items conflict', async () => {
    const baseRow = { character_id: CHAR_ID, max_slots: 60, max_weight_grams: 30_000, created_at: new Date(), updated_at: new Date() }
    const updatedRow = { ...baseRow, max_slots: 30 }
    const pool = makePoolWithExecute(vi.fn()
      .mockResolvedValueOnce([[]])           // INSERT (initial getOrCreateSettings step 1)
      .mockResolvedValueOnce([[baseRow]])    // SELECT (initial getOrCreateSettings step 2)
      .mockResolvedValueOnce([[{ max_slot: null }]])  // MAX(slot) — no items
      .mockResolvedValueOnce([[]])           // UPDATE settings
      .mockResolvedValueOnce([[]])           // INSERT (final getOrCreateSettings step 1)
      .mockResolvedValueOnce([[updatedRow]]) // SELECT (final getOrCreateSettings step 2)
    )
    const repo = new InventoryRepository(pool)
    const result = await repo.updateSettings(CHAR_ID, { maxSlots: 30 })
    expect(result.maxSlots).toBe(30)
  })

  it('throws InventorySettingsConflictError when reducing maxSlots below highest used slot', async () => {
    const baseRow = { character_id: CHAR_ID, max_slots: 60, max_weight_grams: 30_000, created_at: new Date(), updated_at: new Date() }
    const pool = makePoolWithExecute(vi.fn()
      .mockResolvedValueOnce([[]])           // INSERT
      .mockResolvedValueOnce([[baseRow]])    // SELECT
      .mockResolvedValueOnce([[{ max_slot: 15 }]])  // MAX(slot) = 15 — exceeds target of 10
    )
    const repo = new InventoryRepository(pool)
    await expect(repo.updateSettings(CHAR_ID, { maxSlots: 10 })).rejects.toBeInstanceOf(InventorySettingsConflictError)
  })

  it('throws InventorySettingsConflictError when reducing maxWeightGrams below current weight', async () => {
    const baseRow = { character_id: CHAR_ID, max_slots: 60, max_weight_grams: 30_000, created_at: new Date(), updated_at: new Date() }
    const pool = makePoolWithExecute(vi.fn()
      .mockResolvedValueOnce([[]])           // INSERT
      .mockResolvedValueOnce([[baseRow]])    // SELECT
      .mockResolvedValueOnce([[{ total_weight_grams: '5000' }]])  // current weight = 5000g
    )
    const repo = new InventoryRepository(pool)
    await expect(repo.updateSettings(CHAR_ID, { maxWeightGrams: 1000 })).rejects.toBeInstanceOf(InventorySettingsConflictError)
  })
})

// ── Phase 6: addItem — InventoryOverweightError ───────────────────────────────

describe('InventoryRepository — addItem weight enforcement', () => {
  it('throws InventoryOverweightError when item weight would exceed limit', async () => {
    // maxWeightGrams=100, item weighs 200g, current=0g → 0+200 > 100
    const itemRow = { stackable: 0, max_stack: 1, weight_grams: 200, status: 'active', metadata_schema_json: null }
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])        // no existing tx
        .mockResolvedValueOnce([[itemRow]]) // item found (200g)
        .mockResolvedValueOnce([[{ total_weight_grams: '0' }]])  // current weight = 0g
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec({ maxWeightGrams: 100 }), conn))
    await expect(repo.addItem({
      characterId: CHAR_ID,
      itemId: 'heavy_item',
      quantity: 1,
      reason: 'test',
      source: 'system',
      idempotencyKey: 'key-p6-001',
    })).rejects.toBeInstanceOf(InventoryOverweightError)
    expect(conn.rollback).toHaveBeenCalled()
  })
})

// ── Phase 6: addItem — InventoryCapacityError ─────────────────────────────────

describe('InventoryRepository — addItem capacity enforcement', () => {
  it('throws InventoryCapacityError when requested slot > maxSlots', async () => {
    // maxSlots=5, requesting slot=10 → throws before transaction starts
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec({ maxSlots: 5 }), makeConn()))
    await expect(repo.addItem({
      characterId: CHAR_ID,
      itemId: 'water_bottle',
      quantity: 1,
      slot: 10,  // exceeds maxSlots=5
      reason: 'test',
      source: 'system',
      idempotencyKey: 'key-p6-002',
    })).rejects.toBeInstanceOf(InventoryCapacityError)
  })
})

// ── Phase 6: addItem — InventoryMetadataValidationError ───────────────────────

describe('InventoryRepository — addItem metadata validation', () => {
  it('throws InventoryMetadataValidationError when required metadata key missing', async () => {
    const schema = JSON.stringify({ required: ['color'], properties: { color: { type: 'string' } } })
    const itemRow = { stackable: 0, max_stack: 1, weight_grams: 0, status: 'active', metadata_schema_json: schema }
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])        // no existing tx
        .mockResolvedValueOnce([[itemRow]]) // item with required metadata schema
        // metadata validation throws before weight check — no more conn.execute calls
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    await expect(repo.addItem({
      characterId: CHAR_ID,
      itemId: 'special_item',
      quantity: 1,
      reason: 'test',
      source: 'system',
      idempotencyKey: 'key-p6-003',
      // metadata not provided — required key 'color' missing
    })).rejects.toBeInstanceOf(InventoryMetadataValidationError)
    expect(conn.rollback).toHaveBeenCalled()
  })
})

// ── Phase 6: moveItem — InventoryCapacityError ────────────────────────────────

describe('InventoryRepository — moveItem capacity enforcement', () => {
  it('throws InventoryCapacityError when toSlot exceeds maxSlots', async () => {
    // maxSlots=30, toSlot=50 → throws after idempotency check
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])  // no existing tx
        // InventoryCapacityError thrown before slot locks
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec({ maxSlots: 30 }), conn))
    await expect(repo.moveItem({
      characterId: CHAR_ID,
      fromSlot: 1,
      toSlot: 50,  // exceeds maxSlots=30
      idempotencyKey: 'key-p6-004',
    })).rejects.toBeInstanceOf(InventoryCapacityError)
    expect(conn.rollback).toHaveBeenCalled()
  })
})

// ── Phase 6: moveItem — partial split to empty slot ──────────────────────────

describe('InventoryRepository — moveItem partial split', () => {
  it('successfully splits a partial quantity to an empty slot', async () => {
    const fromRow = { id: 'from1', character_id: CHAR_ID, item_id: 'bread', slot: 1, quantity: 10, metadata_json: null, created_at: new Date(), updated_at: new Date() }
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])          // no existing tx
        .mockResolvedValueOnce([[fromRow]])   // lock slot 1 (lowSlot)
        .mockResolvedValueOnce([[]])          // lock slot 5 (highSlot) — empty
        .mockResolvedValueOnce([[]])          // UPDATE fromRow quantity - 3
        .mockResolvedValueOnce([[]])          // INSERT new row at slot 5
        .mockResolvedValueOnce([[]])          // INSERT transaction record
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    const result = await repo.moveItem({
      characterId: CHAR_ID,
      fromSlot: 1,
      toSlot: 5,
      quantity: 3,  // partial move (10 total, move 3)
      idempotencyKey: 'key-p6-005',
    })
    expect(result.slot).toBe(5)
    expect(result.quantity).toBe(3)
    expect(result.idempotent).toBe(false)
    expect(conn.commit).toHaveBeenCalled()
  })
})

// ── Hardening: BUG-6-2 — maxWeightGrams=0 means unlimited ───────────────────

describe('InventoryRepository — BUG-6-2: maxWeightGrams=0 is unlimited', () => {
  it('addItem allows heavy item when maxWeightGrams=0 (unlimited)', async () => {
    const itemRow = { stackable: 0, max_stack: 1, weight_grams: 50_000, status: 'active', metadata_schema_json: null }
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])        // no existing tx
        .mockResolvedValueOnce([[itemRow]]) // item: 50,000g
        .mockResolvedValueOnce([[{ total_weight_grams: '0' }]])  // current weight = 0g
        .mockResolvedValueOnce([[]])        // slot scan — no occupied slots
        .mockResolvedValueOnce([[]])        // INSERT inventory row
        .mockResolvedValueOnce([[]])        // INSERT tx record
    })
    // maxWeightGrams=0 → unlimited; 50,000g item should not be blocked
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec({ maxWeightGrams: 0 }), conn))
    const result = await repo.addItem({
      characterId: CHAR_ID,
      itemId: 'boulder',
      quantity: 1,
      reason: 'test',
      source: 'system',
      idempotencyKey: 'key-h001',
    })
    expect(result.idempotent).toBe(false)
    expect(conn.commit).toHaveBeenCalled()
  })

  it('calculateWeight reports isOverweight=false and remainingWeightGrams=MAX_SAFE_INTEGER when unlimited', async () => {
    const pool = makePoolWithExecute(vi.fn().mockImplementation((query: string) => {
      if (String(query).includes('INSERT INTO atc_character_inventory_settings')) {
        return Promise.resolve([[]])
      }
      if (String(query).includes('SELECT * FROM atc_character_inventory_settings')) {
        return Promise.resolve([[{
          character_id: CHAR_ID, max_slots: 60, max_weight_grams: 0,
          created_at: new Date(), updated_at: new Date(),
        }]])
      }
      // SUM weight — 10,000g worth of items
      return Promise.resolve([[{ total_weight_grams: '10000' }]])
    }))
    const repo = new InventoryRepository(pool)
    const result = await repo.calculateWeight(CHAR_ID)
    expect(result.maxWeightGrams).toBe(0)
    expect(result.isOverweight).toBe(false)
    expect(result.remainingWeightGrams).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('updateSettings to maxWeightGrams=0 never throws conflict even when inventory is heavy', async () => {
    const baseRow = { character_id: CHAR_ID, max_slots: 60, max_weight_grams: 30_000, created_at: new Date(), updated_at: new Date() }
    const updatedRow = { ...baseRow, max_weight_grams: 0 }
    const pool = makePoolWithExecute(vi.fn()
      .mockResolvedValueOnce([[]])           // INSERT (initial getOrCreateSettings)
      .mockResolvedValueOnce([[baseRow]])    // SELECT (initial)
      // maxWeightGrams=0 → skip weight check entirely — no _totalWeightGrams call
      .mockResolvedValueOnce([[]])           // UPDATE settings
      .mockResolvedValueOnce([[]])           // INSERT (final getOrCreateSettings)
      .mockResolvedValueOnce([[updatedRow]]) // SELECT (final)
    )
    const repo = new InventoryRepository(pool)
    const result = await repo.updateSettings(CHAR_ID, { maxWeightGrams: 0 })
    expect(result.maxWeightGrams).toBe(0)
  })
})

// ── Hardening: exact weight limit accepted ───────────────────────────────────

describe('InventoryRepository — weight limit boundary', () => {
  it('accepts item that fills remaining capacity exactly (currentWeight + addedWeight === maxWeightGrams)', async () => {
    // limit=500, current=300, item=200 → 300+200 = 500, NOT > 500 → accepted
    const itemRow = { stackable: 0, max_stack: 1, weight_grams: 200, status: 'active', metadata_schema_json: null }
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])        // no existing tx
        .mockResolvedValueOnce([[itemRow]]) // item: 200g
        .mockResolvedValueOnce([[{ total_weight_grams: '300' }]])  // current=300g
        .mockResolvedValueOnce([[]])        // slot scan
        .mockResolvedValueOnce([[]])        // INSERT inventory row
        .mockResolvedValueOnce([[]])        // INSERT tx record
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec({ maxWeightGrams: 500 }), conn))
    const result = await repo.addItem({
      characterId: CHAR_ID,
      itemId: 'counterweight',
      quantity: 1,
      reason: 'test',
      source: 'system',
      idempotencyKey: 'key-h002',
    })
    expect(result.idempotent).toBe(false)
    expect(conn.commit).toHaveBeenCalled()
  })
})

// ── Hardening: BUG-6-3 — safe-integer overflow guards ───────────────────────

describe('InventoryRepository — BUG-6-3: addedWeightGrams overflow guard', () => {
  it('throws when addedWeightGrams itself overflows MAX_SAFE_INTEGER', async () => {
    // quantity=2, weight_grams=MAX_SAFE_INTEGER → 2*MAX_SAFE_INTEGER > MAX_SAFE_INTEGER
    const itemRow = { stackable: 1, max_stack: 100000, weight_grams: Number.MAX_SAFE_INTEGER, status: 'active', metadata_schema_json: null }
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])        // no existing tx
        .mockResolvedValueOnce([[itemRow]]) // item with enormous weight
        .mockResolvedValueOnce([[{ total_weight_grams: '0' }]])  // current weight = 0
    })
    // maxWeightGrams must be > 0 so weight check isn't skipped
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec({ maxWeightGrams: 30_000 }), conn))
    await expect(repo.addItem({
      characterId: CHAR_ID,
      itemId: 'impossible_item',
      quantity: 2,
      reason: 'test',
      source: 'system',
      idempotencyKey: 'key-h003',
    })).rejects.toThrow(/Weight integrity.*MAX_SAFE_INTEGER/)
    expect(conn.rollback).toHaveBeenCalled()
  })

  it('throws when sum of currentWeight + addedWeight overflows MAX_SAFE_INTEGER', async () => {
    // addedWeightGrams = 2 (safe), currentWeightGrams = MAX_SAFE_INTEGER - 1 → sum > MAX_SAFE_INTEGER
    const itemRow = { stackable: 1, max_stack: 100000, weight_grams: 2, status: 'active', metadata_schema_json: null }
    const hugeCurrentStr = (Number.MAX_SAFE_INTEGER - 1).toString()
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])        // no existing tx
        .mockResolvedValueOnce([[itemRow]]) // item: 2g
        .mockResolvedValueOnce([[{ total_weight_grams: hugeCurrentStr }]])
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec({ maxWeightGrams: 30_000 }), conn))
    await expect(repo.addItem({
      characterId: CHAR_ID,
      itemId: 'feather',
      quantity: 1,
      reason: 'test',
      source: 'system',
      idempotencyKey: 'key-h004',
    })).rejects.toThrow(/Weight integrity/)
    expect(conn.rollback).toHaveBeenCalled()
  })
})

// ── Hardening: BUG-6-1 — malformed metadata_schema_json in DB ────────────────

describe('InventoryRepository — BUG-6-1: malformed metadata schema JSON', () => {
  it('treats malformed metadata_schema_json as no schema (no SyntaxError crash)', async () => {
    const itemRow = { stackable: 0, max_stack: 1, weight_grams: 0, status: 'active', metadata_schema_json: '{invalid json' }
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])        // no existing tx
        .mockResolvedValueOnce([[itemRow]]) // item with malformed schema
        .mockResolvedValueOnce([[{ total_weight_grams: '0' }]])  // weight SUM
        .mockResolvedValueOnce([[]])        // slot scan — empty
        .mockResolvedValueOnce([[]])        // INSERT inventory row
        .mockResolvedValueOnce([[]])        // INSERT tx record
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    // Should NOT throw SyntaxError — malformed schema is silently ignored
    const result = await repo.addItem({
      characterId: CHAR_ID,
      itemId: 'any_item',
      quantity: 1,
      reason: 'test',
      source: 'system',
      idempotencyKey: 'key-h005',
    })
    expect(result.idempotent).toBe(false)
    expect(conn.commit).toHaveBeenCalled()
  })
})

// ── Hardening: boolean metadata type validation ──────────────────────────────

describe('InventoryRepository — boolean metadata validation', () => {
  it('throws InventoryMetadataValidationError when boolean field receives string', async () => {
    const schema = JSON.stringify({ required: ['enabled'], properties: { enabled: { type: 'boolean' } } })
    const itemRow = { stackable: 0, max_stack: 1, weight_grams: 0, status: 'active', metadata_schema_json: schema }
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])        // no existing tx
        .mockResolvedValueOnce([[itemRow]]) // item with boolean schema
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    await expect(repo.addItem({
      characterId: CHAR_ID,
      itemId: 'switch',
      quantity: 1,
      reason: 'test',
      source: 'system',
      idempotencyKey: 'key-h006',
      metadata: { enabled: 'yes' },  // string instead of boolean
    })).rejects.toBeInstanceOf(InventoryMetadataValidationError)
  })
})

// ── Hardening: full SWAP in moveItem ─────────────────────────────────────────

describe('InventoryRepository — moveItem full SWAP', () => {
  it('swaps two different items between slots', async () => {
    const fromRow = { id: 'from1', character_id: CHAR_ID, item_id: 'sword', slot: 1, quantity: 1, metadata_json: null, created_at: new Date(), updated_at: new Date() }
    const toRow   = { id: 'to1',   character_id: CHAR_ID, item_id: 'shield', slot: 5, quantity: 1, metadata_json: null, created_at: new Date(), updated_at: new Date() }
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])          // no existing tx
        .mockResolvedValueOnce([[fromRow]])   // lock slot 1 (lowSlot=fromSlot)
        .mockResolvedValueOnce([[toRow]])     // lock slot 5 (highSlot=toSlot)
        .mockResolvedValueOnce([[]])          // DELETE toRow (shield)
        .mockResolvedValueOnce([[]])          // UPDATE fromRow slot → 5 (sword moves)
        .mockResolvedValueOnce([[]])          // INSERT toRow at fromSlot=1 (shield placed)
        .mockResolvedValueOnce([[]])          // INSERT tx record
    })
    const repo = new InventoryRepository(makeFullPool(makeSettingsPoolExec(), conn))
    const result = await repo.moveItem({
      characterId: CHAR_ID,
      fromSlot: 1,
      toSlot: 5,
      // no quantity → full move → SWAP
      idempotencyKey: 'key-h007',
    })
    expect(result.slot).toBe(5)
    expect(result.itemId).toBe('sword')
    expect(result.idempotent).toBe(false)
    expect(conn.commit).toHaveBeenCalled()
  })
})
