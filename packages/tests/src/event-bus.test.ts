import { describe, it, expect, vi } from 'vitest'
import { AtcEventBus } from '@atc/events'

describe('AtcEventBus — emit and handlers', () => {
  it('calls a registered handler with the payload', async () => {
    const bus = new AtcEventBus()
    const handler = vi.fn()
    bus.on('atc:test:event', handler)
    await bus.emit('atc:test:event', { foo: 'bar' })
    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' })
  })

  it('calls multiple handlers in registration order', async () => {
    const bus = new AtcEventBus()
    const order: number[] = []
    bus.on('atc:test:event', () => { order.push(1) })
    bus.on('atc:test:event', () => { order.push(2) })
    bus.on('atc:test:event', () => { order.push(3) })
    await bus.emit('atc:test:event', null)
    expect(order).toEqual([1, 2, 3])
  })

  it('returns handlersInvoked count', async () => {
    const bus = new AtcEventBus()
    bus.on('atc:test:event', vi.fn())
    bus.on('atc:test:event', vi.fn())
    const result = await bus.emit('atc:test:event', {})
    expect(result.handlersInvoked).toBe(2)
    expect(result.name).toBe('atc:test:event')
  })

  it('returns zero handlersInvoked for unknown event', async () => {
    const bus = new AtcEventBus()
    const result = await bus.emit('atc:unknown', {})
    expect(result.handlersInvoked).toBe(0)
    expect(result.failures).toHaveLength(0)
  })

  it('isolates handler failures — other handlers still run', async () => {
    const bus = new AtcEventBus()
    const after = vi.fn()
    bus.on('atc:test:event', () => { throw new Error('boom') })
    bus.on('atc:test:event', after)
    const result = await bus.emit('atc:test:event', {})
    expect(after).toHaveBeenCalledOnce()
    expect(result.failures).toHaveLength(1)
    expect(result.handlersInvoked).toBe(2)
  })

  it('collects multiple failures without throwing', async () => {
    const bus = new AtcEventBus()
    bus.on('atc:test:event', () => { throw new Error('fail1') })
    bus.on('atc:test:event', () => { throw new Error('fail2') })
    const result = await bus.emit('atc:test:event', {})
    expect(result.failures).toHaveLength(2)
  })

  it('isolates async handler rejections', async () => {
    const bus = new AtcEventBus()
    const after = vi.fn()
    bus.on('atc:test:event', async () => { throw new Error('async boom') })
    bus.on('atc:test:event', after)
    const result = await bus.emit('atc:test:event', {})
    expect(after).toHaveBeenCalledOnce()
    expect(result.failures).toHaveLength(1)
  })
})

describe('AtcEventBus — off()', () => {
  it('removes the handler so it is not called on next emit', async () => {
    const bus = new AtcEventBus()
    const handler = vi.fn()
    bus.on('atc:test:event', handler)
    bus.off('atc:test:event', handler)
    await bus.emit('atc:test:event', {})
    expect(handler).not.toHaveBeenCalled()
  })

  it('only removes the specified handler, leaving others intact', async () => {
    const bus = new AtcEventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('atc:test:event', h1)
    bus.on('atc:test:event', h2)
    bus.off('atc:test:event', h1)
    await bus.emit('atc:test:event', {})
    expect(h1).not.toHaveBeenCalled()
    expect(h2).toHaveBeenCalledOnce()
  })

  it('off() on unknown event is a no-op', () => {
    const bus = new AtcEventBus()
    expect(() => bus.off('atc:unknown', vi.fn())).not.toThrow()
  })
})

describe('AtcEventBus — once()', () => {
  it('fires the handler exactly once', async () => {
    const bus = new AtcEventBus()
    const handler = vi.fn()
    bus.once('atc:test:event', handler)
    await bus.emit('atc:test:event', { n: 1 })
    await bus.emit('atc:test:event', { n: 2 })
    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith({ n: 1 })
  })

  it('once() handler receives the payload', async () => {
    const bus = new AtcEventBus()
    let received: unknown = null
    bus.once('atc:test:event', (p) => { received = p })
    await bus.emit('atc:test:event', { hello: 'world' })
    expect(received).toEqual({ hello: 'world' })
  })

  it('removes once handler even when it rejects asynchronously', async () => {
    const bus = new AtcEventBus()
    bus.once('atc:test:event', async () => { throw new Error('once async rejection') })
    // First emit: handler runs (and fails), but must be removed before the rejection
    const result1 = await bus.emit('atc:test:event', {})
    expect(result1.failures).toHaveLength(1)
    expect(bus.listenerCount('atc:test:event')).toBe(0)
    // Second emit: no handler — no failures, handlersInvoked = 0
    const result2 = await bus.emit('atc:test:event', {})
    expect(result2.handlersInvoked).toBe(0)
    expect(result2.failures).toHaveLength(0)
  })
})

describe('AtcEventBus — listenerCount / eventNames', () => {
  it('listenerCount returns correct count', () => {
    const bus = new AtcEventBus()
    expect(bus.listenerCount('atc:test:event')).toBe(0)
    bus.on('atc:test:event', vi.fn())
    bus.on('atc:test:event', vi.fn())
    expect(bus.listenerCount('atc:test:event')).toBe(2)
  })

  it('eventNames lists registered events', () => {
    const bus = new AtcEventBus()
    bus.on('atc:vitals:changed', vi.fn())
    bus.on('atc:session:created', vi.fn())
    const names = bus.eventNames()
    expect(names).toContain('atc:vitals:changed')
    expect(names).toContain('atc:session:created')
  })
})
