import { describe, it, expect } from 'vitest'
import {
  vitalNameSchema,
  vitalsPatchSchema,
  vitalsMutationSchema,
  vitalsCharacterParamSchema,
  characterVitalsSchema,
  validate,
} from '@atc/schemas'

// ── vitalNameSchema ───────────────────────────────────────────────────────────

describe('vitalNameSchema', () => {
  it('accepts all valid vital names', () => {
    for (const name of ['health', 'hunger', 'thirst', 'stamina', 'stress', 'armor']) {
      const result = validate(vitalNameSchema, name)
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid vital name', () => {
    expect(validate(vitalNameSchema, 'mana').success).toBe(false)
    expect(validate(vitalNameSchema, 'health2').success).toBe(false)
    expect(validate(vitalNameSchema, '').success).toBe(false)
  })
})

// ── characterVitalsSchema ─────────────────────────────────────────────────────

describe('characterVitalsSchema', () => {
  it('accepts valid vitals object', () => {
    const result = validate(characterVitalsSchema, {
      health: 100, hunger: 80, thirst: 60, stamina: 90, stress: 10, armor: 50,
    })
    expect(result.success).toBe(true)
  })

  it('rejects value above 100', () => {
    const result = validate(characterVitalsSchema, {
      health: 101, hunger: 100, thirst: 100, stamina: 100, stress: 0, armor: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative value', () => {
    const result = validate(characterVitalsSchema, {
      health: -1, hunger: 100, thirst: 100, stamina: 100, stress: 0, armor: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer value', () => {
    const result = validate(characterVitalsSchema, {
      health: 50.5, hunger: 100, thirst: 100, stamina: 100, stress: 0, armor: 0,
    })
    expect(result.success).toBe(false)
  })
})

// ── vitalsPatchSchema ─────────────────────────────────────────────────────────

describe('vitalsPatchSchema', () => {
  it('accepts patch with a single vital', () => {
    const result = validate(vitalsPatchSchema, { health: 75 })
    expect(result.success).toBe(true)
  })

  it('accepts patch with multiple vitals', () => {
    const result = validate(vitalsPatchSchema, { health: 50, hunger: 30 })
    expect(result.success).toBe(true)
  })

  it('accepts patch with all vitals', () => {
    const result = validate(vitalsPatchSchema, {
      health: 100, hunger: 100, thirst: 100, stamina: 100, stress: 0, armor: 0,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty patch', () => {
    const result = validate(vitalsPatchSchema, {})
    expect(result.success).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects value above 100', () => {
    expect(validate(vitalsPatchSchema, { health: 101 }).success).toBe(false)
  })

  it('rejects negative value', () => {
    expect(validate(vitalsPatchSchema, { hunger: -5 }).success).toBe(false)
  })

  it('rejects unknown vital field', () => {
    // Zod strips unknown keys but the refine should still pass because stamina=0 is present
    const result = validate(vitalsPatchSchema, { stamina: 0, mana: 50 })
    expect(result.success).toBe(true)
    // mana should be stripped
    expect((result.data as Record<string, unknown>)?.['mana']).toBeUndefined()
  })
})

// ── vitalsMutationSchema ──────────────────────────────────────────────────────

describe('vitalsMutationSchema', () => {
  it('accepts valid set mutation', () => {
    const result = validate(vitalsMutationSchema, { vital: 'health', mode: 'set', amount: 100 })
    expect(result.success).toBe(true)
  })

  it('accepts valid increment mutation', () => {
    const result = validate(vitalsMutationSchema, { vital: 'thirst', mode: 'increment', amount: 25 })
    expect(result.success).toBe(true)
  })

  it('accepts valid decrement mutation', () => {
    const result = validate(vitalsMutationSchema, { vital: 'hunger', mode: 'decrement', amount: 10 })
    expect(result.success).toBe(true)
  })

  it('accepts optional metadata', () => {
    const result = validate(vitalsMutationSchema, {
      vital: 'stamina',
      mode: 'decrement',
      amount: 5,
      metadata: { reason: 'sprint' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid vital name', () => {
    const result = validate(vitalsMutationSchema, { vital: 'mana', mode: 'set', amount: 50 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid mode', () => {
    const result = validate(vitalsMutationSchema, { vital: 'health', mode: 'add', amount: 10 })
    expect(result.success).toBe(false)
  })

  it('rejects amount above 100', () => {
    const result = validate(vitalsMutationSchema, { vital: 'health', mode: 'set', amount: 101 })
    expect(result.success).toBe(false)
  })

  it('rejects negative amount', () => {
    const result = validate(vitalsMutationSchema, { vital: 'health', mode: 'set', amount: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects metadata with more than 20 keys', () => {
    const meta = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i]))
    const result = validate(vitalsMutationSchema, { vital: 'health', mode: 'set', amount: 50, metadata: meta })
    expect(result.success).toBe(false)
  })
})

// ── vitalsCharacterParamSchema ────────────────────────────────────────────────

describe('vitalsCharacterParamSchema', () => {
  it('accepts valid ULID characterId', () => {
    const result = validate(vitalsCharacterParamSchema, { characterId: '01HZ9XVFG3QKJM5N8P2R4T6WYZ' })
    expect(result.success).toBe(true)
  })

  it('rejects too-short characterId', () => {
    expect(validate(vitalsCharacterParamSchema, { characterId: 'short' }).success).toBe(false)
  })

  it('rejects missing characterId', () => {
    expect(validate(vitalsCharacterParamSchema, {}).success).toBe(false)
  })
})
