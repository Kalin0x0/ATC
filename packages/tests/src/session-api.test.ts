import { describe, it, expect } from 'vitest'
import { validate } from '@atc/schemas'
import {
  sessionCreateRequestSchema,
  sessionResponseSchema,
  sourceParamSchema,
} from '@atc/schemas'

const VALID_ULID = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'

describe('sessionCreateRequestSchema', () => {
  const valid = {
    accountId: VALID_ULID,
    source: 1,
    name: 'TestPlayer',
    primaryIdentifier: 'license:abc',
    language: 'en',
  }

  it('accepts a valid session create request', () => {
    const result = validate(sessionCreateRequestSchema, valid)
    expect(result.success).toBe(true)
  })

  it('rejects source 0 (must be positive)', () => {
    const result = validate(sessionCreateRequestSchema, { ...valid, source: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative source', () => {
    const result = validate(sessionCreateRequestSchema, { ...valid, source: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid accountId', () => {
    const result = validate(sessionCreateRequestSchema, { ...valid, accountId: 'bad-id' })
    expect(result.success).toBe(false)
  })

  it('rejects unsupported language', () => {
    const result = validate(sessionCreateRequestSchema, { ...valid, language: 'zh' })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = validate(sessionCreateRequestSchema, { ...valid, name: '' })
    expect(result.success).toBe(false)
  })

  it('accepts all supported languages', () => {
    for (const lang of ['en', 'de', 'fa']) {
      const result = validate(sessionCreateRequestSchema, { ...valid, language: lang })
      expect(result.success).toBe(true)
    }
  })
})

describe('sessionResponseSchema', () => {
  const valid = {
    sessionId: VALID_ULID,
    accountId: VALID_ULID,
    source: 42,
    language: 'de',
    state: 'connecting',
  }

  it('accepts a valid session response', () => {
    const result = validate(sessionResponseSchema, valid)
    expect(result.success).toBe(true)
  })

  it('accepts active state', () => {
    const result = validate(sessionResponseSchema, { ...valid, state: 'active' })
    expect(result.success).toBe(true)
  })

  it('accepts ended state', () => {
    const result = validate(sessionResponseSchema, { ...valid, state: 'ended' })
    expect(result.success).toBe(true)
  })

  it('rejects unknown state', () => {
    const result = validate(sessionResponseSchema, { ...valid, state: 'unknown' })
    expect(result.success).toBe(false)
  })

  it('rejects missing sessionId', () => {
    const { sessionId: _omit, ...rest } = valid
    const result = validate(sessionResponseSchema, rest)
    expect(result.success).toBe(false)
  })
})

describe('sourceParamSchema', () => {
  it('accepts numeric source', () => {
    const result = validate(sourceParamSchema, { source: 1 })
    expect(result.success).toBe(true)
  })

  it('coerces string source to number', () => {
    const result = validate(sourceParamSchema, { source: '42' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.source).toBe(42)
    }
  })

  it('rejects source 0', () => {
    const result = validate(sourceParamSchema, { source: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative source', () => {
    const result = validate(sourceParamSchema, { source: -5 })
    expect(result.success).toBe(false)
  })

  it('rejects non-numeric string', () => {
    const result = validate(sourceParamSchema, { source: 'abc' })
    expect(result.success).toBe(false)
  })
})
