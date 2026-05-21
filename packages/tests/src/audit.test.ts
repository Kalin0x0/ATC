import { describe, it, expect, vi } from 'vitest'
import { AtcAuditService } from '@atc/audit'

function makeService(opts: { maxEvents?: number } = {}) {
  return new AtcAuditService(opts)
}

const BASE_INPUT = {
  actorId: 'u-1',
  actorType: 'account' as const,
  action: 'player.read',
  result: 'granted' as const,
}

describe('AtcAuditService — append()', () => {
  it('returns an immutable event with a UUID id', () => {
    const svc = makeService()
    const event = svc.append(BASE_INPUT)
    expect(event.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(Object.isFrozen(event)).toBe(true)
  })

  it('sets all fields from input', () => {
    const svc = makeService()
    const event = svc.append({
      ...BASE_INPUT,
      target: 'char-1',
      sourceInstanceId: 'node-1',
      metadata: { reason: 'test' },
    })
    expect(event.actorId).toBe('u-1')
    expect(event.actorType).toBe('account')
    expect(event.action).toBe('player.read')
    expect(event.result).toBe('granted')
    expect(event.target).toBe('char-1')
    expect(event.sourceInstanceId).toBe('node-1')
    expect(event.metadata).toEqual({ reason: 'test' })
  })

  it('defaults target and sourceInstanceId to null when omitted', () => {
    const svc = makeService()
    const event = svc.append(BASE_INPUT)
    expect(event.target).toBeNull()
    expect(event.sourceInstanceId).toBeNull()
  })

  it('metadata object is frozen', () => {
    const svc = makeService()
    const event = svc.append({ ...BASE_INPUT, metadata: { x: 1 } })
    expect(Object.isFrozen(event.metadata)).toBe(true)
  })

  it('increments total on every append', () => {
    const svc = makeService()
    svc.append(BASE_INPUT)
    svc.append(BASE_INPUT)
    expect(svc.getTotal()).toBe(2)
  })

  it('evicts oldest event when maxEvents is exceeded', () => {
    const svc = makeService({ maxEvents: 3 })
    const first = svc.append({ ...BASE_INPUT, action: 'first' })
    svc.append(BASE_INPUT)
    svc.append(BASE_INPUT)
    svc.append(BASE_INPUT)
    // first event should be evicted
    expect(svc.size()).toBe(3)
    const { events } = svc.list({ limit: 200 })
    expect(events.find((e) => e.id === first.id)).toBeUndefined()
  })

  it('getTotal() keeps counting even after eviction', () => {
    const svc = makeService({ maxEvents: 2 })
    svc.append(BASE_INPUT)
    svc.append(BASE_INPUT)
    svc.append(BASE_INPUT)
    expect(svc.getTotal()).toBe(3)
    expect(svc.size()).toBe(2)
  })

  it('increments audit_events_total telemetry', () => {
    const telemetry = { increment: vi.fn() }
    const svc = new AtcAuditService({ telemetry })
    svc.append(BASE_INPUT)
    expect(telemetry.increment).toHaveBeenCalledWith('security.audit_events_total')
  })
})

describe('AtcAuditService — list()', () => {
  it('returns empty page when no events appended', () => {
    const svc = makeService()
    const page = svc.list()
    expect(page.events).toHaveLength(0)
    expect(page.total).toBe(0)
  })

  it('returns all events up to default limit (50)', () => {
    const svc = makeService()
    for (let i = 0; i < 60; i++) svc.append(BASE_INPUT)
    const page = svc.list()
    expect(page.events).toHaveLength(50)
    expect(page.limit).toBe(50)
  })

  it('respects custom limit', () => {
    const svc = makeService()
    for (let i = 0; i < 10; i++) svc.append(BASE_INPUT)
    const page = svc.list({ limit: 5 })
    expect(page.events).toHaveLength(5)
  })

  it('clamps limit at 200', () => {
    const svc = makeService()
    for (let i = 0; i < 10; i++) svc.append(BASE_INPUT)
    const page = svc.list({ limit: 999 })
    expect(page.limit).toBe(200)
  })

  it('respects offset for pagination', () => {
    const svc = makeService()
    const a = svc.append({ ...BASE_INPUT, action: 'a' })
    const b = svc.append({ ...BASE_INPUT, action: 'b' })
    const page = svc.list({ offset: 1, limit: 10 })
    expect(page.events[0]?.id).toBe(b.id)
    void a
  })

  it('filters by actorId', () => {
    const svc = makeService()
    svc.append({ ...BASE_INPUT, actorId: 'u-1' })
    svc.append({ ...BASE_INPUT, actorId: 'u-2' })
    const page = svc.list({ actorId: 'u-2' })
    expect(page.events).toHaveLength(1)
    expect(page.events[0]?.actorId).toBe('u-2')
  })

  it('filters by action', () => {
    const svc = makeService()
    svc.append({ ...BASE_INPUT, action: 'player.read' })
    svc.append({ ...BASE_INPUT, action: 'player.write' })
    const page = svc.list({ action: 'player.write' })
    expect(page.events).toHaveLength(1)
    expect(page.events[0]?.action).toBe('player.write')
  })

  it('filters by result', () => {
    const svc = makeService()
    svc.append({ ...BASE_INPUT, result: 'granted' })
    svc.append({ ...BASE_INPUT, result: 'denied' })
    const page = svc.list({ result: 'denied' })
    expect(page.events).toHaveLength(1)
    expect(page.events[0]?.result).toBe('denied')
  })

  it('returns correct total and offset in page', () => {
    const svc = makeService()
    for (let i = 0; i < 5; i++) svc.append(BASE_INPUT)
    const page = svc.list({ offset: 2, limit: 10 })
    expect(page.total).toBe(5)
    expect(page.offset).toBe(2)
    expect(page.limit).toBe(10)
  })

  it('can combine multiple filters', () => {
    const svc = makeService()
    svc.append({ ...BASE_INPUT, actorId: 'u-1', action: 'player.read', result: 'granted' })
    svc.append({ ...BASE_INPUT, actorId: 'u-1', action: 'player.write', result: 'denied' })
    svc.append({ ...BASE_INPUT, actorId: 'u-2', action: 'player.read', result: 'granted' })
    const page = svc.list({ actorId: 'u-1', result: 'granted' })
    expect(page.events).toHaveLength(1)
    expect(page.events[0]?.action).toBe('player.read')
  })
})
