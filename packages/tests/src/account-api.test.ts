import { describe, it, expect } from 'vitest'
import { validate } from '@atc/schemas'
import {
  accountIdentifiersSchema,
  accountUpsertRequestSchema,
  accountUpsertResponseSchema,
  banCheckResponseSchema,
  identifierParamSchema,
} from '@atc/schemas'

describe('accountIdentifiersSchema', () => {
  it('accepts a single identifier', () => {
    const result = validate(accountIdentifiersSchema, { license: 'abc123' })
    expect(result.success).toBe(true)
  })

  it('accepts multiple identifiers', () => {
    const result = validate(accountIdentifiersSchema, {
      license: 'abc',
      discord: '123456789',
      steam: 'steam:xyz',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty object (no identifiers)', () => {
    const result = validate(accountIdentifiersSchema, {})
    expect(result.success).toBe(false)
  })

  it('rejects empty string identifier', () => {
    const result = validate(accountIdentifiersSchema, { license: '' })
    expect(result.success).toBe(false)
  })
})

describe('accountUpsertRequestSchema', () => {
  const valid = {
    primaryIdentifier: 'license:abc123',
    identifiers: { license: 'abc123' },
    preferredLanguage: 'en',
  }

  it('accepts a valid request', () => {
    const result = validate(accountUpsertRequestSchema, valid)
    expect(result.success).toBe(true)
  })

  it('rejects missing primaryIdentifier', () => {
    const result = validate(accountUpsertRequestSchema, { ...valid, primaryIdentifier: '' })
    expect(result.success).toBe(false)
  })

  it('rejects unsupported language', () => {
    const result = validate(accountUpsertRequestSchema, { ...valid, preferredLanguage: 'jp' })
    expect(result.success).toBe(false)
  })

  it('accepts all supported languages', () => {
    for (const lang of ['en', 'de', 'fa']) {
      const result = validate(accountUpsertRequestSchema, { ...valid, preferredLanguage: lang })
      expect(result.success).toBe(true)
    }
  })
})

describe('accountUpsertResponseSchema', () => {
  it('accepts a valid active response', () => {
    const result = validate(accountUpsertResponseSchema, {
      accountId: '01HZ9XVFG3QKJM5N8P2R4T6WYZ',
      status: 'active',
      preferredLanguage: 'de',
      created: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts banned status', () => {
    const result = validate(accountUpsertResponseSchema, {
      accountId: '01HZ9XVFG3QKJM5N8P2R4T6WYZ',
      status: 'banned',
      preferredLanguage: 'en',
      created: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = validate(accountUpsertResponseSchema, {
      accountId: '01HZ9XVFG3QKJM5N8P2R4T6WYZ',
      status: 'deleted',
      preferredLanguage: 'en',
      created: false,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-ULID accountId', () => {
    const result = validate(accountUpsertResponseSchema, {
      accountId: 'not-a-ulid',
      status: 'active',
      preferredLanguage: 'en',
      created: false,
    })
    expect(result.success).toBe(false)
  })
})

describe('banCheckResponseSchema', () => {
  it('accepts allowed response with null accountId', () => {
    const result = validate(banCheckResponseSchema, {
      allowed: true,
      status: 'active',
      reason: null,
      accountId: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts banned response', () => {
    const result = validate(banCheckResponseSchema, {
      allowed: false,
      status: 'banned',
      reason: 'Cheating',
      accountId: '01HZ9XVFG3QKJM5N8P2R4T6WYZ',
    })
    expect(result.success).toBe(true)
  })
})

describe('identifierParamSchema', () => {
  it('accepts valid identifier', () => {
    const result = validate(identifierParamSchema, { identifier: 'license:abc123' })
    expect(result.success).toBe(true)
  })

  it('rejects empty identifier', () => {
    const result = validate(identifierParamSchema, { identifier: '' })
    expect(result.success).toBe(false)
  })
})
