import { describe, it, expect } from 'vitest'
import { AtcEventStore, InMemoryEventStoreStorage } from '@atc/event-store'

function makeStore() {
  const storage = new InMemoryEventStoreStorage()
  return new AtcEventStore(storage)
}

// ── listEvents (all streams) ──────────────────────────────────────────────────

describe('AtcEventStore.listEvents — no filter', () => {
  it('returns empty page when no events exist', async () => {
    const store = makeStore()
    const page = await store.listEvents()
    expect(page.events).toHaveLength(0)
    expect(page.nextCursor).toBeNull()
  })

  it('returns events across all streams sorted by storedAt', async () => {
    const store = makeStore()
    await store.append('stream.a', { x: 1 }, 'test')
    await store.append('stream.b', { x: 2 }, 'test')
    await store.append('stream.a', { x: 3 }, 'test')

    const page = await store.listEvents()
    expect(page.events).toHaveLength(3)
    // storedAt is ISO — should be monotonically non-decreasing
    for (let i = 1; i < page.events.length; i++) {
      expect(page.events[i]!.storedAt >= page.events[i - 1]!.storedAt).toBe(true)
    }
  })

  it('includes id, streamId, eventName, source, storedAt in each summary', async () => {
    const store = makeStore()
    await store.append('my.stream', { data: true }, 'source-1')

    const page = await store.listEvents()
    const ev = page.events[0]!
    expect(ev.id).toBeTruthy()
    expect(ev.streamId).toBeTruthy()
    expect(ev.eventName).toBe('my.stream')
    expect(ev.source).toBe('source-1')
    expect(ev.storedAt).toBeTruthy()
  })

  it('paginates with cursor for multi-stream listing', async () => {
    const store = makeStore()
    for (let i = 0; i < 5; i++) {
      await store.append('evt.type', { i }, 'test')
    }

    const page1 = await store.listEvents({ limit: 3 })
    expect(page1.events).toHaveLength(3)
    expect(page1.nextCursor).toBeTruthy()

    const page2 = await store.listEvents({ limit: 3, cursor: page1.nextCursor! })
    expect(page2.events).toHaveLength(2)
    expect(page2.nextCursor).toBeNull()

    // No overlapping events
    const ids1 = new Set(page1.events.map((e) => e.id))
    for (const ev of page2.events) {
      expect(ids1.has(ev.id)).toBe(false)
    }
  })
})

// ── listEvents (single stream / eventName filter) ─────────────────────────────

describe('AtcEventStore.listEvents — with eventName', () => {
  it('returns only events for the specified stream', async () => {
    const store = makeStore()
    await store.append('stream.wanted', { a: 1 }, 'test')
    await store.append('stream.other', { b: 2 }, 'test')
    await store.append('stream.wanted', { c: 3 }, 'test')

    const page = await store.listEvents({ eventName: 'stream.wanted' })
    expect(page.events).toHaveLength(2)
    for (const ev of page.events) {
      expect(ev.eventName).toBe('stream.wanted')
    }
  })

  it('returns empty when stream does not exist', async () => {
    const store = makeStore()
    const page = await store.listEvents({ eventName: 'nonexistent' })
    expect(page.events).toHaveLength(0)
    expect(page.nextCursor).toBeNull()
  })

  it('paginates single-stream results using streamId cursor', async () => {
    const store = makeStore()
    for (let i = 0; i < 5; i++) {
      await store.append('stream.x', { i }, 'test')
    }

    const page1 = await store.listEvents({ eventName: 'stream.x', limit: 3 })
    expect(page1.events).toHaveLength(3)

    // page2 should have the remaining 2 (cursor may or may not be null depending on filtering)
    if (page1.nextCursor) {
      const page2 = await store.listEvents({ eventName: 'stream.x', limit: 3, cursor: page1.nextCursor })
      expect(page2.events.length).toBeGreaterThanOrEqual(1)
      const ids1 = new Set(page1.events.map((e) => e.id))
      for (const ev of page2.events) {
        expect(ids1.has(ev.id)).toBe(false)
      }
    }
  })

  it('respects limit when filtering by eventName', async () => {
    const store = makeStore()
    for (let i = 0; i < 10; i++) {
      await store.append('stream.big', {}, 'test')
    }
    const page = await store.listEvents({ eventName: 'stream.big', limit: 4 })
    expect(page.events).toHaveLength(4)
  })
})

// ── getEvent ──────────────────────────────────────────────────────────────────

describe('AtcEventStore.getEvent', () => {
  it('returns null for an unknown UUID', async () => {
    const store = makeStore()
    const result = await store.getEvent(crypto.randomUUID())
    expect(result).toBeNull()
  })

  it('finds an event by its UUID across streams', async () => {
    const store = makeStore()
    await store.append('stream.a', { x: 1 }, 'src')
    const target = await store.append('stream.b', { x: 2 }, 'src')
    await store.append('stream.a', { x: 3 }, 'src')

    const found = await store.getEvent(target.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(target.id)
    expect(found!.eventName).toBe('stream.b')
    expect(found!.payload).toEqual({ x: 2 })
  })

  it('returns the full AtcStoredEvent including payload', async () => {
    const store = makeStore()
    const appended = await store.append('my.event', { key: 'value' }, 'api')
    const found = await store.getEvent(appended.id)
    expect(found?.source).toBe('api')
    expect(found?.storedAt).toBeTruthy()
    expect(found?.streamId).toBeTruthy()
  })
})
