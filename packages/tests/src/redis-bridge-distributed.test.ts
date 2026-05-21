import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AtcRedisEventBridge } from '@atc/events'
import type { BridgeRedisLike } from '@atc/events'

type EventListener = (channel: string, message: string) => void
type StateListener = (...args: unknown[]) => void

function makeBridgeRedis(nodeId = 'node-1'): {
  pub: BridgeRedisLike
  sub: BridgeRedisLike & { _messageListeners: EventListener[]; _stateListeners: Map<string, StateListener[]> }
  simulateMessage: (channel: string, message: string) => void
  simulateState: (event: string) => void
} {
  const _messageListeners: EventListener[] = []
  const _stateListeners = new Map<string, StateListener[]>()

  const sub = {
    _messageListeners,
    _stateListeners,
    async publish() { return 0 },
    async subscribe() { return 'OK' },
    async unsubscribe() { return 'OK' },
    duplicate() { return this },
    on(event: string, listener: unknown) {
      if (event === 'message') {
        _messageListeners.push(listener as EventListener)
      } else {
        const list = _stateListeners.get(event) ?? []
        list.push(listener as StateListener)
        _stateListeners.set(event, list)
      }
      return this
    },
    async quit() { return 'OK' },
  } as BridgeRedisLike & { _messageListeners: EventListener[]; _stateListeners: Map<string, StateListener[]> }

  const pub: BridgeRedisLike = {
    async publish() { return 1 },
    async subscribe() { return 'OK' },
    async unsubscribe() { return 'OK' },
    duplicate() { return sub },
    on() { return pub as BridgeRedisLike },
    async quit() { return 'OK' },
  }

  return {
    pub,
    sub,
    simulateMessage: (channel, message) => {
      for (const l of _messageListeners) l(channel, message)
    },
    simulateState: (event) => {
      for (const l of _stateListeners.get(event) ?? []) l()
    },
  }
}

function makeEnvelope(eventName: string, payload: unknown, sourceNodeId: string, eventId?: string) {
  return JSON.stringify({
    eventId: eventId ?? `evt-${Math.random().toString(36).slice(2)}`,
    sourceNodeId,
    emittedAt: new Date().toISOString(),
    eventName,
    payload,
  })
}

describe('AtcRedisEventBridge — loop prevention', () => {
  it('drops messages originating from the same node', () => {
    const { pub, simulateMessage } = makeBridgeRedis()
    const bridge = new AtcRedisEventBridge(pub, 'node-self')
    const handler = vi.fn()
    bridge.subscribe('user.created', handler)

    // Message from self → should be dropped
    simulateMessage(
      'atc:events:user.created',
      makeEnvelope('user.created', { id: 1 }, 'node-self'),
    )
    expect(handler).not.toHaveBeenCalled()
  })

  it('delivers messages from other nodes', async () => {
    const { pub, simulateMessage } = makeBridgeRedis()
    const bridge = new AtcRedisEventBridge(pub, 'node-self')
    const handler = vi.fn()
    bridge.subscribe('user.created', handler)

    simulateMessage(
      'atc:events:user.created',
      makeEnvelope('user.created', { id: 2 }, 'node-other'),
    )
    // Handlers are called via Promise.resolve — flush microtasks
    await Promise.resolve()
    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith({ id: 2 })
  })
})

describe('AtcRedisEventBridge — event deduplication', () => {
  it('delivers a new event only once per eventId', async () => {
    const { pub, simulateMessage } = makeBridgeRedis()
    const bridge = new AtcRedisEventBridge(pub, 'node-self')
    const handler = vi.fn()
    bridge.subscribe('order.placed', handler)

    const msg = makeEnvelope('order.placed', { orderId: 'abc' }, 'node-other', 'evt-dedup-1')
    simulateMessage('atc:events:order.placed', msg)
    simulateMessage('atc:events:order.placed', msg) // duplicate

    await Promise.resolve()
    expect(handler).toHaveBeenCalledOnce()
  })

  it('delivers events with different eventIds independently', async () => {
    const { pub, simulateMessage } = makeBridgeRedis()
    const bridge = new AtcRedisEventBridge(pub, 'node-self')
    const handler = vi.fn()
    bridge.subscribe('order.placed', handler)

    simulateMessage('atc:events:order.placed', makeEnvelope('order.placed', { n: 1 }, 'node-other', 'evt-1'))
    simulateMessage('atc:events:order.placed', makeEnvelope('order.placed', { n: 2 }, 'node-other', 'evt-2'))

    await Promise.resolve()
    expect(handler).toHaveBeenCalledTimes(2)
  })
})

describe('AtcRedisEventBridge — subscribe / unsubscribe', () => {
  it('subscribe adds a handler and delivers messages', async () => {
    const { pub, simulateMessage } = makeBridgeRedis()
    const bridge = new AtcRedisEventBridge(pub, 'node-a')
    const h1 = vi.fn()
    bridge.subscribe('task.done', h1)

    simulateMessage('atc:events:task.done', makeEnvelope('task.done', {}, 'node-b'))
    await Promise.resolve()
    expect(h1).toHaveBeenCalledOnce()
  })

  it('does not add the same handler twice', async () => {
    const { pub, simulateMessage } = makeBridgeRedis()
    const bridge = new AtcRedisEventBridge(pub, 'node-a')
    const h = vi.fn()
    bridge.subscribe('task.done', h)
    bridge.subscribe('task.done', h) // duplicate subscribe

    simulateMessage('atc:events:task.done', makeEnvelope('task.done', {}, 'node-b'))
    await Promise.resolve()
    expect(h).toHaveBeenCalledOnce() // fired once, not twice
  })

  it('unsubscribe removes the handler', async () => {
    const { pub, simulateMessage } = makeBridgeRedis()
    const bridge = new AtcRedisEventBridge(pub, 'node-a')
    const h = vi.fn()
    bridge.subscribe('task.done', h)
    bridge.unsubscribe('task.done', h)

    simulateMessage('atc:events:task.done', makeEnvelope('task.done', {}, 'node-b'))
    await Promise.resolve()
    expect(h).not.toHaveBeenCalled()
  })

  it('getSubscribedEvents returns currently subscribed event names', () => {
    const { pub } = makeBridgeRedis()
    const bridge = new AtcRedisEventBridge(pub, 'node-a')
    bridge.subscribe('ev.a', vi.fn())
    bridge.subscribe('ev.b', vi.fn())
    const events = bridge.getSubscribedEvents()
    expect(events).toContain('ev.a')
    expect(events).toContain('ev.b')
  })

  it('getSubscribedEvents excludes unsubscribed events', () => {
    const { pub } = makeBridgeRedis()
    const bridge = new AtcRedisEventBridge(pub, 'node-a')
    const h = vi.fn()
    bridge.subscribe('ev.gone', h)
    bridge.unsubscribe('ev.gone', h)
    expect(bridge.getSubscribedEvents()).not.toContain('ev.gone')
  })
})

describe('AtcRedisEventBridge — reconnect resubscription', () => {
  it('resubscribes all channels when Redis reconnects (ready event)', async () => {
    const { pub, sub, simulateState } = makeBridgeRedis()
    const subscribe = vi.spyOn(sub, 'subscribe').mockResolvedValue('OK' as unknown)
    const bridge = new AtcRedisEventBridge(pub, 'node-a')

    bridge.subscribe('ev.x', vi.fn())
    bridge.subscribe('ev.y', vi.fn())
    subscribe.mockClear() // clear initial subscribe calls

    // Simulate Redis reconnect
    simulateState('ready')
    await Promise.resolve()

    const subscribedChannels = subscribe.mock.calls.map((c) => c[0])
    expect(subscribedChannels).toContain('atc:events:ev.x')
    expect(subscribedChannels).toContain('atc:events:ev.y')
  })
})

describe('AtcRedisEventBridge — connection state', () => {
  it('starts in connected state', () => {
    const { pub } = makeBridgeRedis()
    const bridge = new AtcRedisEventBridge(pub, 'node-a')
    expect(bridge.connectionState).toBe('connected')
  })

  it('transitions to reconnecting on reconnecting event', () => {
    const { pub, simulateState } = makeBridgeRedis()
    const bridge = new AtcRedisEventBridge(pub, 'node-a')
    simulateState('reconnecting')
    expect(bridge.connectionState).toBe('reconnecting')
  })

  it('transitions to degraded on error event', () => {
    const { pub, simulateState } = makeBridgeRedis()
    const bridge = new AtcRedisEventBridge(pub, 'node-a')
    simulateState('error')
    expect(bridge.connectionState).toBe('degraded')
  })

  it('transitions to failed on end event', () => {
    const { pub, simulateState } = makeBridgeRedis()
    const bridge = new AtcRedisEventBridge(pub, 'node-a')
    simulateState('end')
    expect(bridge.connectionState).toBe('failed')
  })

  it('transitions back to connected on ready event', () => {
    const { pub, simulateState } = makeBridgeRedis()
    const bridge = new AtcRedisEventBridge(pub, 'node-a')
    simulateState('reconnecting')
    simulateState('ready')
    expect(bridge.connectionState).toBe('connected')
  })
})

describe('AtcRedisEventBridge — publish', () => {
  it('publishes to the correct channel with envelope format', async () => {
    const { pub } = makeBridgeRedis()
    const publish = vi.spyOn(pub, 'publish')
    const bridge = new AtcRedisEventBridge(pub, 'node-pub')
    await bridge.publish('test.event', { value: 42 })
    expect(publish).toHaveBeenCalledOnce()
    const [channel, raw] = publish.mock.calls[0]!
    expect(channel).toBe('atc:events:test.event')
    const envelope = JSON.parse(raw as string) as { eventName: string; sourceNodeId: string; payload: unknown }
    expect(envelope.eventName).toBe('test.event')
    expect(envelope.sourceNodeId).toBe('node-pub')
    expect(envelope.payload).toEqual({ value: 42 })
  })

  it('is a no-op after close()', async () => {
    const { pub } = makeBridgeRedis()
    const publish = vi.spyOn(pub, 'publish')
    const bridge = new AtcRedisEventBridge(pub, 'node-pub')
    await bridge.close()
    await bridge.publish('test.event', {})
    expect(publish).not.toHaveBeenCalled()
  })
})

describe('AtcRedisEventBridge — malformed messages', () => {
  it('drops non-JSON messages without throwing', async () => {
    const { pub, simulateMessage } = makeBridgeRedis()
    const bridge = new AtcRedisEventBridge(pub, 'node-a')
    const h = vi.fn()
    bridge.subscribe('ev.x', h)
    simulateMessage('atc:events:ev.x', 'not-valid-json{{')
    await Promise.resolve()
    expect(h).not.toHaveBeenCalled()
  })

  it('ignores messages on unknown channels (no prefix)', async () => {
    const { pub, simulateMessage } = makeBridgeRedis()
    const bridge = new AtcRedisEventBridge(pub, 'node-a')
    const h = vi.fn()
    bridge.subscribe('ev.x', h)
    simulateMessage('other:channel', makeEnvelope('ev.x', {}, 'node-b'))
    await Promise.resolve()
    expect(h).not.toHaveBeenCalled()
  })
})
