import { describe, it, expect } from 'vitest'
import { validate } from '@atc/schemas'
import { characterCreateSchema } from '@atc/schemas'

const VALID_ACCOUNT_ID = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'

describe('characterCreateSchema', () => {
  it('accepts a valid minimal character create payload', () => {
    const result = validate(characterCreateSchema, {
      accountId: VALID_ACCOUNT_ID,
      slot: 1,
      firstName: 'John',
      lastName: 'Doe',
      gender: 'male',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a full payload with all optional fields', () => {
    const result = validate(characterCreateSchema, {
      accountId: VALID_ACCOUNT_ID,
      slot: 3,
      firstName: "Marie-Claire",
      lastName: "O'Brien",
      gender: 'female',
      dateOfBirth: '1995-06-15',
      nationality: 'French',
      metadata: { skin: 'pale', height: 165 },
    })
    expect(result.success).toBe(true)
  })

  it('rejects firstName with invalid characters (digits)', () => {
    const result = validate(characterCreateSchema, {
      accountId: VALID_ACCOUNT_ID,
      slot: 1,
      firstName: 'John123',
      lastName: 'Doe',
      gender: 'male',
    })
    expect(result.success).toBe(false)
  })

  it('rejects firstName shorter than 2 characters', () => {
    const result = validate(characterCreateSchema, {
      accountId: VALID_ACCOUNT_ID,
      slot: 1,
      firstName: 'J',
      lastName: 'Doe',
      gender: 'male',
    })
    expect(result.success).toBe(false)
  })

  it('rejects lastName with special characters', () => {
    const result = validate(characterCreateSchema, {
      accountId: VALID_ACCOUNT_ID,
      slot: 1,
      firstName: 'John',
      lastName: 'Do@e',
      gender: 'male',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a future dateOfBirth', () => {
    const result = validate(characterCreateSchema, {
      accountId: VALID_ACCOUNT_ID,
      slot: 1,
      firstName: 'John',
      lastName: 'Doe',
      gender: 'male',
      dateOfBirth: '2099-01-01',
    })
    expect(result.success).toBe(false)
  })

  it('rejects slot 0 (minimum is 1)', () => {
    const result = validate(characterCreateSchema, {
      accountId: VALID_ACCOUNT_ID,
      slot: 0,
      firstName: 'John',
      lastName: 'Doe',
      gender: 'male',
    })
    expect(result.success).toBe(false)
  })

  it('rejects slot 6 (maximum is 5)', () => {
    const result = validate(characterCreateSchema, {
      accountId: VALID_ACCOUNT_ID,
      slot: 6,
      firstName: 'John',
      lastName: 'Doe',
      gender: 'male',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid gender value', () => {
    const result = validate(characterCreateSchema, {
      accountId: VALID_ACCOUNT_ID,
      slot: 1,
      firstName: 'John',
      lastName: 'Doe',
      gender: 'unknown',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid accountId (too short)', () => {
    const result = validate(characterCreateSchema, {
      accountId: 'not-a-valid-ulid',
      slot: 1,
      firstName: 'John',
      lastName: 'Doe',
      gender: 'male',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid gender values', () => {
    for (const gender of ['male', 'female', 'other']) {
      const result = validate(characterCreateSchema, {
        accountId: VALID_ACCOUNT_ID,
        slot: 1,
        firstName: 'Sam',
        lastName: 'Lee',
        gender,
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts all valid slot values 1-5', () => {
    for (const slot of [1, 2, 3, 4, 5]) {
      const result = validate(characterCreateSchema, {
        accountId: VALID_ACCOUNT_ID,
        slot,
        firstName: 'Sam',
        lastName: 'Lee',
        gender: 'other',
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects all-whitespace firstName (hardening: trim + min(2))', () => {
    const result = validate(characterCreateSchema, {
      accountId: VALID_ACCOUNT_ID,
      slot: 1,
      firstName: '   ',
      lastName: 'Doe',
      gender: 'male',
    })
    expect(result.success).toBe(false)
  })

  it('trims leading/trailing spaces from firstName before validation', () => {
    const result = validate(characterCreateSchema, {
      accountId: VALID_ACCOUNT_ID,
      slot: 1,
      firstName: '  Jo  ',
      lastName: 'Doe',
      gender: 'male',
    })
    // "Jo" after trim — 2 chars, valid
    expect(result.success).toBe(true)
  })

  it('rejects metadata with more than 20 keys', () => {
    const bigMeta = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i]))
    const result = validate(characterCreateSchema, {
      accountId: VALID_ACCOUNT_ID,
      slot: 1,
      firstName: 'John',
      lastName: 'Doe',
      gender: 'male',
      metadata: bigMeta,
    })
    expect(result.success).toBe(false)
  })

  it('accepts metadata with exactly 20 keys', () => {
    const meta = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i]))
    const result = validate(characterCreateSchema, {
      accountId: VALID_ACCOUNT_ID,
      slot: 1,
      firstName: 'John',
      lastName: 'Doe',
      gender: 'male',
      metadata: meta,
    })
    expect(result.success).toBe(true)
  })
})
