import { describe, it, expect } from 'vitest'
import {
  validate,
  validateOrThrow,
  uuidV7Schema,
  semverSchema,
  atcEventNameSchema,
  atcSecurityRiskScoreSchema,
  atcSecurityViolationSchema,
  createAccountDtoSchema,
} from '@atc/schemas'

describe('uuidV7Schema', () => {
  it('accepts a 26-char alphanumeric string', () => {
    expect(uuidV7Schema.safeParse('01J4G2KXVZP8T1MR3N0QW6H7SY').success).toBe(true)
  })

  it('rejects strings shorter or longer than 26 chars', () => {
    expect(uuidV7Schema.safeParse('short').success).toBe(false)
    expect(uuidV7Schema.safeParse('A'.repeat(27)).success).toBe(false)
  })

  it('rejects strings with special characters', () => {
    expect(uuidV7Schema.safeParse('01J4G2KX!ZP8T1MR3N0QW6H7SY').success).toBe(false)
  })
})

describe('semverSchema', () => {
  it('accepts valid semver', () => {
    expect(semverSchema.safeParse('1.0.0').success).toBe(true)
    expect(semverSchema.safeParse('0.1.0-alpha.1').success).toBe(true)
    expect(semverSchema.safeParse('2.3.4+build.123').success).toBe(true)
  })

  it('rejects non-semver strings', () => {
    expect(semverSchema.safeParse('v1.0.0').success).toBe(false)
    expect(semverSchema.safeParse('1.0').success).toBe(false)
    expect(semverSchema.safeParse('latest').success).toBe(false)
  })
})

describe('atcEventNameSchema', () => {
  it('accepts valid event names', () => {
    expect(atcEventNameSchema.safeParse('atc:core:client:ready').success).toBe(true)
    expect(atcEventNameSchema.safeParse('atc:player:connected').success).toBe(true)
    expect(atcEventNameSchema.safeParse('atc:locale:request').success).toBe(true)
  })

  it('rejects event names not starting with atc:', () => {
    expect(atcEventNameSchema.safeParse('qb:player:loaded').success).toBe(false)
    expect(atcEventNameSchema.safeParse('player:connected').success).toBe(false)
  })

  it('rejects event names with uppercase letters', () => {
    expect(atcEventNameSchema.safeParse('atc:Player:connected').success).toBe(false)
  })

  it('rejects event names with hyphens in segments', () => {
    expect(atcEventNameSchema.safeParse('atc:player-data:get').success).toBe(false)
  })
})

describe('atcSecurityRiskScoreSchema', () => {
  it('accepts score of 0', () => {
    const result = atcSecurityRiskScoreSchema.safeParse({
      identifier: 'license:abc',
      score: 0,
      level: 'normal',
      events: [],
      lastUpdated: Date.now(),
    })
    expect(result.success).toBe(true)
  })

  it('accepts scores above 200 (old cap removed)', () => {
    const result = atcSecurityRiskScoreSchema.safeParse({
      identifier: 'license:abc',
      score: 350,
      level: 'critical',
      events: [],
      lastUpdated: Date.now(),
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative scores', () => {
    const result = atcSecurityRiskScoreSchema.safeParse({
      identifier: 'license:abc',
      score: -1,
      level: 'normal',
      events: [],
      lastUpdated: Date.now(),
    })
    expect(result.success).toBe(false)
  })
})

describe('validate() helper', () => {
  it('returns success:true with data on valid input', () => {
    const result = validate(semverSchema, '1.0.0')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe('1.0.0')
  })

  it('returns success:false with errors on invalid input', () => {
    const result = validate(semverSchema, 'not-a-version')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe('validateOrThrow() helper', () => {
  it('returns data on valid input', () => {
    expect(validateOrThrow(semverSchema, '2.0.0')).toBe('2.0.0')
  })

  it('throws on invalid input', () => {
    expect(() => validateOrThrow(semverSchema, 'bad')).toThrow()
  })
})

describe('createAccountDtoSchema', () => {
  it('accepts a valid account DTO', () => {
    const result = createAccountDtoSchema.safeParse({
      identifier: 'license:abc123',
      licenses: ['license:abc123'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty licenses array', () => {
    const result = createAccountDtoSchema.safeParse({
      identifier: 'license:abc123',
      licenses: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid IP in lastIp', () => {
    const result = createAccountDtoSchema.safeParse({
      identifier: 'license:abc123',
      licenses: ['license:abc123'],
      lastIp: 'not-an-ip',
    })
    expect(result.success).toBe(false)
  })
})
