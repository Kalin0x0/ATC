import { describe, it, expect } from 'vitest'
import { itemActionConfigSchema, itemUseSchema, itemEffectResultSchema, cooldownSchema } from '@atc/schemas'
import { validate } from '@atc/schemas'

// ── itemActionConfigSchema ────────────────────────────────────────────────────

describe('itemActionConfigSchema', () => {
  it('accepts a minimal consume config', () => {
    const result = validate(itemActionConfigSchema, { type: 'consume' })
    expect(result.success).toBe(true)
    expect(result.data?.type).toBe('consume')
  })

  it('accepts a full config with all optional fields', () => {
    const result = validate(itemActionConfigSchema, {
      type: 'consume',
      cooldownMs: 5000,
      consumeQuantity: 2,
      durabilityCost: 10,
      destroyOnEmpty: true,
      serverEvent: 'medkit.use',
    })
    expect(result.success).toBe(true)
    expect(result.data?.cooldownMs).toBe(5000)
    expect(result.data?.consumeQuantity).toBe(2)
  })

  it('accepts cooldown_only and custom_event types', () => {
    expect(validate(itemActionConfigSchema, { type: 'cooldown_only' }).success).toBe(true)
    expect(validate(itemActionConfigSchema, { type: 'custom_event', serverEvent: 'food.eat' }).success).toBe(true)
  })

  it('rejects invalid type', () => {
    const result = validate(itemActionConfigSchema, { type: 'weapon_attack' })
    expect(result.success).toBe(false)
  })

  it('rejects cooldownMs over 24 hours', () => {
    const result = validate(itemActionConfigSchema, { type: 'consume', cooldownMs: 86_400_001 })
    expect(result.success).toBe(false)
  })

  it('rejects cooldownMs below 0', () => {
    const result = validate(itemActionConfigSchema, { type: 'consume', cooldownMs: -1 })
    expect(result.success).toBe(false)
  })

  it('allows cooldownMs = 0', () => {
    const result = validate(itemActionConfigSchema, { type: 'consume', cooldownMs: 0 })
    expect(result.success).toBe(true)
  })

  it('rejects consumeQuantity below 1', () => {
    const result = validate(itemActionConfigSchema, { type: 'consume', consumeQuantity: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects durabilityCost below 0', () => {
    const result = validate(itemActionConfigSchema, { type: 'consume', durabilityCost: -5 })
    expect(result.success).toBe(false)
  })

  it('allows durabilityCost = 0', () => {
    const result = validate(itemActionConfigSchema, { type: 'consume', durabilityCost: 0 })
    expect(result.success).toBe(true)
  })

  it('rejects serverEvent shorter than 3 chars', () => {
    const result = validate(itemActionConfigSchema, { type: 'consume', serverEvent: 'ab' })
    expect(result.success).toBe(false)
  })

  it('rejects serverEvent longer than 128 chars', () => {
    const result = validate(itemActionConfigSchema, { type: 'consume', serverEvent: 'x'.repeat(129) })
    expect(result.success).toBe(false)
  })

  it('accepts serverEvent of exactly 3 chars', () => {
    const result = validate(itemActionConfigSchema, { type: 'consume', serverEvent: 'abc' })
    expect(result.success).toBe(true)
  })
})

// ── itemUseSchema ─────────────────────────────────────────────────────────────

describe('itemUseSchema', () => {
  it('accepts valid slot and idempotency key', () => {
    const result = validate(itemUseSchema, {
      slot: 5,
      idempotencyKey: 'atc:use:1:char1:5:12345:999',
    })
    expect(result.success).toBe(true)
    expect(result.data?.slot).toBe(5)
  })

  it('rejects slot 0', () => {
    const result = validate(itemUseSchema, { slot: 0, idempotencyKey: 'key1' })
    expect(result.success).toBe(false)
  })

  it('rejects slot 121', () => {
    const result = validate(itemUseSchema, { slot: 121, idempotencyKey: 'key1' })
    expect(result.success).toBe(false)
  })

  it('rejects slot 120 — valid boundary', () => {
    const result = validate(itemUseSchema, { slot: 120, idempotencyKey: 'key1' })
    expect(result.success).toBe(true)
  })

  it('rejects non-integer slot', () => {
    const result = validate(itemUseSchema, { slot: 1.5, idempotencyKey: 'key1' })
    expect(result.success).toBe(false)
  })

  it('rejects missing idempotencyKey', () => {
    const result = validate(itemUseSchema, { slot: 5 })
    expect(result.success).toBe(false)
  })
})

// ── itemEffectResultSchema ────────────────────────────────────────────────────

describe('itemEffectResultSchema', () => {
  it('accepts a minimal effect result', () => {
    const result = validate(itemEffectResultSchema, { type: 'medkit.use', success: true })
    expect(result.success).toBe(true)
  })

  it('accepts effect result with data', () => {
    const result = validate(itemEffectResultSchema, {
      type: 'food.eat',
      success: true,
      data: { hunger: -30 },
    })
    expect(result.success).toBe(true)
    expect(result.data?.data).toEqual({ hunger: -30 })
  })

  it('rejects missing success field', () => {
    const result = validate(itemEffectResultSchema, { type: 'food.eat' })
    expect(result.success).toBe(false)
  })
})

// ── cooldownSchema ────────────────────────────────────────────────────────────

describe('cooldownSchema', () => {
  it('accepts a valid cooldown', () => {
    const expiresAt = new Date(Date.now() + 5000)
    const result = validate(cooldownSchema, {
      characterId: '01HZ9XVFG3QKJM5N8P2R4T6WYZ',
      slot: 5,
      expiresAt,
    })
    expect(result.success).toBe(true)
    expect(result.data?.slot).toBe(5)
  })

  it('rejects invalid UUID characterId', () => {
    const result = validate(cooldownSchema, {
      characterId: 'not-a-uuid',
      slot: 5,
      expiresAt: new Date(),
    })
    expect(result.success).toBe(false)
  })
})
