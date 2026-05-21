import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AtcRedisEventBridge } from '@atc/events'

const CHANNEL_PREFIX = 'atc:events:'
const TEST_NODE_ID = 'test-node'
const OTHER_NODE_ID = 'other-node'

function makeRedisPair() {
  const messageHandlers: Map<string, (channel: string, raw: string) => void> = new Map()

  // Mock sub-client (subscriber mode)
  const sub = {
    on: vi.fn((event: string, handler: (channel: string, raw: string) => void) => {
      if (event === 'message') messageHandlers.set('message', handler)
    }),
    subscribe: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
  }

  // Mock pub-client (shared connection)
  const pub = {
    publish: vi.fn().mockResolvedValue(1),
    duplicate: vi.fn().mockReturnValue(sub),
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue(undefined),
  }

  return {
    pub,
    sub,
    trigger: (channel: string, raw: string) => {
      const handler = messageHandlers.get('message')
      if (handler) handler(channel, raw)
    },
  }
}

function makeEnvelope(
  eventName: string,
  payload: unknown,
  sourceNodeId: string = OTHER_NODE_ID,
): string {
  return JSON.stringify({
    eventId: `evt-${Math.random().toString(36).slice(2)}`,
    sourceNodeId,
    emittedAt: new Date().toISOString(),
    eventName,
    payload,
  })
}

// ── publish ───────────────────────────────────────────────────────────────────

describe('AtcRedisEventBridge — publish', () => {
  it('publishes to the correct channel with an envelope-wrapped payload', async () => {
    const { pub } = makeRedisPair()
    const bridge = new AtcRedisEventBridge(pub as never, TEST_NODE_ID)
    await bridge.publish('atc:vitals:changed', { characterId: 'char-001' })

    expect(pub.publish).toHaveBeenCalledOnce()
    const [channel, rawArg] = (pub.publish as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string]
    expect(channel).toBe(`${CHANNEL_PREFIX}atc:vitals:changed`)
    const envelope = JSON.parse(rawArg) as { sourceNodeId: string; payload: unknown; eventId: string; emittedAt: string }
    expect(envelope.sourceNodeId).toBe(TEST_NODE_ID)
    expect(envelope.payload).toEqual({ characterId: 'char-001' })
    expect(typeof envelope.eventId).toBe('string')
    expect(typeof envelope.emittedAt).toBe('string')
  })

  it('each publish generates a unique eventId', async () => {
    const { pub } = makeRedisPair()
    const bridge = new AtcRedisEventBridge(pub as never, TEST_NODE_ID)
    await bridge.publish('atc:test', {})
    await bridge.publish('atc:test', {})

    const calls = (pub.publish as ReturnType<typeof vi.fn>).mock.calls as [string, string][]
    const id1 = (JSON.parse(calls[0]![1]) as { eventId: string }).eventId
    const id2 = (JSON.parse(calls[1]![1]) as { eventId: string }).eventId
    expect(id1).not.toBe(id2)
  })

  it('does not throw when Redis publish fails (non-fatal)', async () => {
    const { pub } = makeRedisPair()
    ;(pub.publish as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis down'))
    const bridge = new AtcRedisEventBridge(pub as never, TEST_NODE_ID)
    await expect(bridge.publish('atc:test:event', {})).resolves.toBeUndefined()
  })

  it('is silent after close()', async () => {
    const { pub } = makeRedisPair()
    const bridge = new AtcRedisEventBridge(pub as never, TEST_NODE_ID)
    await bridge.close()
    await bridge.publish('atc:test:event', { x: 1 })
    expect(pub.publish).not.toHaveBeenCalled()
  })
})

// ── subscribe & deliver ───────────────────────────────────────────────────────

describe('AtcRedisEventBridge — subscribe', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('subscribes to the correct channel', () => {
    const { pub, sub } = makeRedisPair()
    const bridge = new AtcRedisEventBridge(pub as never, TEST_NODE_ID)
    bridge.subscribe('atc:vitals:changed', vi.fn())
    expect(sub.subscribe).toHaveBeenCalledWith(`${CHANNEL_PREFIX}atc:vitals:changed`)
  })

  it('delivers parsed payload to the registered handler', async () => {
    const { pub, trigger } = makeRedisPair()
    const bridge = new AtcRedisEventBridge(pub as never, TEST_NODE_ID)
    const handler = vi.fn()
    bridge.subscribe('atc:vitals:changed', handler)

    const payload = { characterId: 'char-001', vitals: { hunger: 15 } }
    trigger(`${CHANNEL_PREFIX}atc:vitals:changed`, makeEnvelope('atc:vitals:changed', payload))

    await new Promise((r) => setTimeout(r, 0))
    expect(handler).toHaveBeenCalledWith(payload)
  })

  it('ignores messages on unrelated channels', async () => {
    const { pub, trigger } = makeRedisPair()
    const bridge = new AtcRedisEventBridge(pub as never, TEST_NODE_ID)
    const handler = vi.fn()
    bridge.subscribe('atc:vitals:changed', handler)

    trigger('other:channel:event', JSON.stringify({ foo: 'bar' }))
    await new Promise((r) => setTimeout(r, 0))
    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores malformed JSON without throwing', async () => {
    const { pub, trigger } = makeRedisPair()
    const bridge = new AtcRedisEventBridge(pub as never, TEST_NODE_ID)
    const handler = vi.fn()
    bridge.subscribe('atc:vitals:changed', handler)

    trigger(`${CHANNEL_PREFIX}atc:vitals:changed`, '{invalid json')
    await new Promise((r) => setTimeout(r, 0))
    expect(handler).not.toHaveBeenCalled()
  })

  it('delivers to multiple handlers for the same event', async () => {
    const { pub, trigger } = makeRedisPair()
    const bridge = new AtcRedisEventBridge(pub as never, TEST_NODE_ID)
    const h1 = vi.fn()
    const h2 = vi.fn()
    bridge.subscribe('atc:status:changed', h1)
    bridge.subscribe('atc:status:changed', h2)

    trigger(`${CHANNEL_PREFIX}atc:status:changed`, makeEnvelope('atc:status:changed', { type: 'fatigue' }))
    await new Promise((r) => setTimeout(r, 0))
    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
  })

  it('same handler registered twice is called only once per message', async () => {
    const { pub, trigger } = makeRedisPair()
    const bridge = new AtcRedisEventBridge(pub as never, TEST_NODE_ID)
    const handler = vi.fn()
    bridge.subscribe('atc:vitals:changed', handler)
    bridge.subscribe('atc:vitals:changed', handler)

    trigger(`${CHANNEL_PREFIX}atc:vitals:changed`, makeEnvelope('atc:vitals:changed', { x: 1 }))
    await new Promise((r) => setTimeout(r, 0))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not re-subscribe the Redis channel for additional handlers', () => {
    const { pub, sub } = makeRedisPair()
    const bridge = new AtcRedisEventBridge(pub as never, TEST_NODE_ID)
    bridge.subscribe('atc:vitals:changed', vi.fn())
    bridge.subscribe('atc:vitals:changed', vi.fn())
    expect(sub.subscribe).toHaveBeenCalledOnce()
  })
})

// ── distributed: self-node prevention ────────────────────────────────────────

describe('AtcRedisEventBridge — self-node loop prevention', () => {
  it('does not deliver events whose sourceNodeId matches the bridge nodeId', async () => {
    const { pub, trigger } = makeRedisPair()
    const bridge = new AtcRedisEventBridge(pub as never, 'my-node')
    const handler = vi.fn()
    bridge.subscribe('atc:vitals:changed', handler)

    trigger(
      `${CHANNEL_PREFIX}atc:vitals:changed`,
      makeEnvelope('atc:vitals:changed', { characterId: 'char-001' }, 'my-node'),
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(handler).not.toHaveBeenCalled()
  })

  it('delivers events from a different nodeId', async () => {
    const { pub, trigger } = makeRedisPair()
    const bridge = new AtcRedisEventBridge(pub as never, 'node-a')
    const handler = vi.fn()
    bridge.subscribe('atc:vitals:changed', handler)

    trigger(
      `${CHANNEL_PREFIX}atc:vitals:changed`,
      makeEnvelope('atc:vitals:changed', { characterId: 'char-001' }, 'node-b'),
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('envelope with missing sourceNodeId is delivered (fail-open for safety)', async () => {
    const { pub, trigger } = makeRedisPair()
    const bridge = new AtcRedisEventBridge(pub as never, 'node-a')
    const handler = vi.fn()
    bridge.subscribe('atc:vitals:changed', handler)

    // Envelope missing sourceNodeId (malformed metadata but valid JSON)
    trigger(
      `${CHANNEL_PREFIX}atc:vitals:changed`,
      JSON.stringify({ eventId: 'x', emittedAt: new Date().toISOString(), eventName: 'atc:vitals:changed', payload: { z: 1 } }),
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(handler).toHaveBeenCalledWith({ z: 1 })
  })
})

// ── close ─────────────────────────────────────────────────────────────────────

describe('AtcRedisEventBridge — close', () => {
  it('calls quit on the subscriber connection', async () => {
    const { pub, sub } = makeRedisPair()
    const bridge = new AtcRedisEventBridge(pub as never, TEST_NODE_ID)
    await bridge.close()
    expect(sub.quit).toHaveBeenCalledOnce()
  })

  it('close() is idempotent — second call does nothing', async () => {
    const { pub, sub } = makeRedisPair()
    const bridge = new AtcRedisEventBridge(pub as never, TEST_NODE_ID)
    await bridge.close()
    await bridge.close()
    expect(sub.quit).toHaveBeenCalledTimes(1)
  })

  it('does not throw when sub.quit fails', async () => {
    const { pub, sub } = makeRedisPair()
    ;(sub.quit as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('quit failed'))
    const bridge = new AtcRedisEventBridge(pub as never, TEST_NODE_ID)
    await expect(bridge.close()).resolves.toBeUndefined()
  })
})
