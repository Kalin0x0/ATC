import { describe, it, expect } from 'vitest'
import { buildEventEnvelope } from '@atc/sdk'
import { atcEventEnvelopeSchema } from '@atc/schemas'
import { ATC_CORE_EVENTS } from '@atc/shared-types'

describe('buildEventEnvelope', () => {
  it('produces a structurally correct envelope', () => {
    const envelope = buildEventEnvelope(ATC_CORE_EVENTS.CLIENT_READY, { language: 'en' }, 42)
    expect(envelope._version).toBe(1)
    expect(envelope._event).toBe(ATC_CORE_EVENTS.CLIENT_READY)
    expect(envelope._source).toBe(42)
    expect(typeof envelope._traceId).toBe('string')
    expect(envelope._traceId).toHaveLength(26)
    expect(typeof envelope._timestamp).toBe('number')
    expect(envelope.payload).toEqual({ language: 'en' })
  })

  it('sets _source to null when omitted', () => {
    const envelope = buildEventEnvelope('atc:core:server:ready', {})
    expect(envelope._source).toBeNull()
  })

  it('generates unique traceIds', () => {
    const ids = new Set(
      Array.from({ length: 20 }, () =>
        buildEventEnvelope('atc:core:server:ready', {})._traceId
      )
    )
    expect(ids.size).toBe(20)
  })
})

describe('atcEventEnvelopeSchema', () => {
  it('validates a correct envelope', () => {
    const envelope = buildEventEnvelope(ATC_CORE_EVENTS.SERVER_READY, { ok: true }, 1)
    const result = atcEventEnvelopeSchema.safeParse(envelope)
    expect(result.success).toBe(true)
  })

  it('rejects a negative source', () => {
    const envelope = { ...buildEventEnvelope(ATC_CORE_EVENTS.SERVER_READY, {}), _source: -1 }
    const result = atcEventEnvelopeSchema.safeParse(envelope)
    expect(result.success).toBe(false)
  })

  it('rejects a missing _event field', () => {
    const { _event: _, ...incomplete } = buildEventEnvelope(ATC_CORE_EVENTS.SERVER_READY, {})
    const result = atcEventEnvelopeSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects a malformed event name', () => {
    const envelope = { ...buildEventEnvelope(ATC_CORE_EVENTS.SERVER_READY, {}), _event: 'bad-name' }
    const result = atcEventEnvelopeSchema.safeParse(envelope)
    expect(result.success).toBe(false)
  })

  it('rejects non-positive _version', () => {
    const envelope = { ...buildEventEnvelope(ATC_CORE_EVENTS.SERVER_READY, {}), _version: 0 }
    const result = atcEventEnvelopeSchema.safeParse(envelope)
    expect(result.success).toBe(false)
  })
})
