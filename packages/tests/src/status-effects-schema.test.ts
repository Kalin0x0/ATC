import { describe, it, expect } from 'vitest'
import {
  validate,
  statusEffectTypeSchema,
  statusEffectSeveritySchema,
  statusEffectSourceSchema,
  statusEffectSchema,
  applyStatusEffectSchema,
  statusEffectsResponseSchema,
  statusEffectCharacterParamSchema,
  statusEffectTypeParamSchema,
} from '@atc/schemas'

const CHAR_ID = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'

// ── statusEffectTypeSchema ────────────────────────────────────────────────────

describe('statusEffectTypeSchema', () => {
  it('accepts all valid types', () => {
    for (const t of ['fatigue', 'dehydrated', 'starving', 'stressed', 'injured', 'custom']) {
      expect(validate(statusEffectTypeSchema, t).success).toBe(true)
    }
  })

  it('rejects invalid type', () => {
    expect(validate(statusEffectTypeSchema, 'poisoned').success).toBe(false)
    expect(validate(statusEffectTypeSchema, '').success).toBe(false)
  })
})

// ── statusEffectSeveritySchema ────────────────────────────────────────────────

describe('statusEffectSeveritySchema', () => {
  it('accepts all valid severities', () => {
    for (const s of ['low', 'medium', 'high', 'critical']) {
      expect(validate(statusEffectSeveritySchema, s).success).toBe(true)
    }
  })

  it('rejects invalid severity', () => {
    expect(validate(statusEffectSeveritySchema, 'severe').success).toBe(false)
  })
})

// ── statusEffectSourceSchema ──────────────────────────────────────────────────

describe('statusEffectSourceSchema', () => {
  it('accepts all valid sources', () => {
    for (const s of ['vitals', 'item', 'system', 'admin']) {
      expect(validate(statusEffectSourceSchema, s).success).toBe(true)
    }
  })

  it('rejects invalid source', () => {
    expect(validate(statusEffectSourceSchema, 'player').success).toBe(false)
  })
})

// ── statusEffectSchema ────────────────────────────────────────────────────────

function validEffect(overrides: Record<string, unknown> = {}) {
  return {
    id: `status:${CHAR_ID}:fatigue`,
    characterId: CHAR_ID,
    type: 'fatigue',
    severity: 'medium',
    source: 'vitals',
    reason: 'Stamina critically low',
    startedAt: new Date().toISOString(),
    expiresAt: null,
    ...overrides,
  }
}

describe('statusEffectSchema — valid', () => {
  it('accepts a valid status effect with no expiresAt', () => {
    expect(validate(statusEffectSchema, validEffect()).success).toBe(true)
  })

  it('accepts a valid status effect with expiresAt set', () => {
    const result = validate(statusEffectSchema, validEffect({
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    }))
    expect(result.success).toBe(true)
  })

  it('accepts optional metadata with ≤20 keys', () => {
    const metadata = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i]))
    expect(validate(statusEffectSchema, validEffect({ metadata })).success).toBe(true)
  })
})

describe('statusEffectSchema — invalid', () => {
  it('rejects invalid severity', () => {
    expect(validate(statusEffectSchema, validEffect({ severity: 'extreme' })).success).toBe(false)
  })

  it('rejects invalid type', () => {
    expect(validate(statusEffectSchema, validEffect({ type: 'broken' })).success).toBe(false)
  })

  it('rejects reason shorter than 3 chars', () => {
    expect(validate(statusEffectSchema, validEffect({ reason: 'ab' })).success).toBe(false)
  })

  it('rejects reason longer than 128 chars', () => {
    expect(validate(statusEffectSchema, validEffect({ reason: 'x'.repeat(129) })).success).toBe(false)
  })

  it('rejects metadata with >20 keys', () => {
    const metadata = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i]))
    expect(validate(statusEffectSchema, validEffect({ metadata })).success).toBe(false)
  })

  it('rejects missing required field', () => {
    const { reason: _r, ...noReason } = validEffect()
    expect(validate(statusEffectSchema, noReason).success).toBe(false)
  })
})

// ── applyStatusEffectSchema ───────────────────────────────────────────────────

describe('applyStatusEffectSchema', () => {
  it('accepts minimal valid apply request', () => {
    const result = validate(applyStatusEffectSchema, {
      type: 'starving',
      severity: 'high',
      source: 'vitals',
      reason: 'Hunger critically low',
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional durationSeconds within 1–86400', () => {
    expect(validate(applyStatusEffectSchema, {
      type: 'custom', severity: 'low', source: 'system', reason: 'Test effect', durationSeconds: 3600,
    }).success).toBe(true)
  })

  it('rejects durationSeconds of 0', () => {
    expect(validate(applyStatusEffectSchema, {
      type: 'custom', severity: 'low', source: 'system', reason: 'Test', durationSeconds: 0,
    }).success).toBe(false)
  })

  it('rejects durationSeconds above 86400', () => {
    expect(validate(applyStatusEffectSchema, {
      type: 'custom', severity: 'low', source: 'system', reason: 'Test', durationSeconds: 86401,
    }).success).toBe(false)
  })

  it('rejects metadata with >20 keys', () => {
    const metadata = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i]))
    expect(validate(applyStatusEffectSchema, {
      type: 'custom', severity: 'low', source: 'system', reason: 'Test', metadata,
    }).success).toBe(false)
  })
})

// ── statusEffectsResponseSchema ───────────────────────────────────────────────

describe('statusEffectsResponseSchema', () => {
  it('accepts valid response with empty effects array', () => {
    expect(validate(statusEffectsResponseSchema, { characterId: CHAR_ID, effects: [] }).success).toBe(true)
  })

  it('accepts response with one effect', () => {
    expect(validate(statusEffectsResponseSchema, {
      characterId: CHAR_ID,
      effects: [validEffect()],
    }).success).toBe(true)
  })

  it('rejects characterId shorter than 20 chars', () => {
    expect(validate(statusEffectsResponseSchema, { characterId: 'short', effects: [] }).success).toBe(false)
  })
})

// ── statusEffectCharacterParamSchema ─────────────────────────────────────────

describe('statusEffectCharacterParamSchema', () => {
  it('accepts a valid characterId', () => {
    expect(validate(statusEffectCharacterParamSchema, { characterId: CHAR_ID }).success).toBe(true)
  })

  it('rejects characterId that is too short', () => {
    expect(validate(statusEffectCharacterParamSchema, { characterId: 'abc' }).success).toBe(false)
  })
})

// ── statusEffectTypeParamSchema ───────────────────────────────────────────────

describe('statusEffectTypeParamSchema', () => {
  it('accepts valid characterId + type', () => {
    expect(validate(statusEffectTypeParamSchema, { characterId: CHAR_ID, type: 'fatigue' }).success).toBe(true)
  })

  it('rejects invalid type in params', () => {
    expect(validate(statusEffectTypeParamSchema, { characterId: CHAR_ID, type: 'unknown' }).success).toBe(false)
  })
})
