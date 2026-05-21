import { describe, it, expect, beforeEach } from 'vitest'
import { AtcEventStore, InMemoryEventStoreStorage } from '@atc/event-store'

describe('InMemoryEventStoreStorage', () => {
  let storage: InMemoryEventStoreStorage

  beforeEach(() => {
    storage = new InMemoryEventStoreStorage()
  })

  it('append returns a stream ID', async () => {
    const id = await storage.append('test-stream', 'event-id', '{}', 'test', new Date().toISOString())
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('len returns event count', async () => {
    await storage.append('s', 'id1', '{}', 'sys', new Date().toISOString())
    await storage.append('s', 'id2', '{}', 'sys', new Date().toISOString())
    expect(await storage.len('s')).toBe(2)
  })

  it('range returns all events with start=0', async () => {
    await storage.append('s', 'id1', '{"x":1}', 'sys', new Date().toISOString())
    await storage.append('s', 'id2', '{"x":2}', 'sys', new Date().toISOString())
    const entries = await storage.range('s', '0', '+', 100)
    expect(entries).toHaveLength(2)
    expect(entries[0]!.id).toBe('id1')
    expect(entries[1]!.id).toBe('id2')
  })

  it('trimByCount trims to max length', async () => {
    for (let i = 0; i < 5; i++) {
      await storage.append('s', `id${i}`, '{}', 'sys', new Date().toISOString())
    }
    await storage.trimByCount('s', 3)
    expect(await storage.len('s')).toBe(3)
  })

  it('trimByAge removes old events', async () => {
    const old = new Date(Date.now() - 10_000).toISOString()
    const recent = new Date().toISOString()
    await storage.append('s', 'old', '{}', 'sys', old)
    await storage.append('s', 'new', '{}', 'sys', recent)

    const cutoff = new Date(Date.now() - 5_000).toISOString()
    await storage.trimByAge('s', cutoff)

    const entries = await storage.range('s', '0', '+', 100)
    expect(entries).toHaveLength(1)
    expect(entries[0]!.id).toBe('new')
  })

  it('allStreamKeys returns all stream names', async () => {
    await storage.append('stream-a', 'id1', '{}', 'sys', new Date().toISOString())
    await storage.append('stream-b', 'id2', '{}', 'sys', new Date().toISOString())
    expect(storage.allStreamKeys()).toEqual(expect.arrayContaining(['stream-a', 'stream-b']))
  })
})

describe('AtcEventStore', () => {
  let store: AtcEventStore

  beforeEach(() => {
    store = new AtcEventStore(new InMemoryEventStoreStorage())
  })

  it('append stores an event and returns AtcStoredEvent', async () => {
    const event = await store.append('atc:task:completed', { taskId: 'abc', type: 'test.job' }, 'system')
    expect(event.id).toBeDefined()
    expect(event.streamId).toBeDefined()
    expect(event.eventName).toBe('atc:task:completed')
    expect(event.payload).toEqual({ taskId: 'abc', type: 'test.job' })
    expect(event.source).toBe('system')
    expect(event.storedAt).toBeDefined()
  })

  it('replay returns all stored events from beginning', async () => {
    await store.append('atc:task:queued', { taskId: '1' }, 'api')
    await store.append('atc:task:queued', { taskId: '2' }, 'api')
    await store.append('atc:task:queued', { taskId: '3' }, 'api')

    const events = await store.replay('atc:task:queued')
    expect(events).toHaveLength(3)
    expect(events[0]!.payload).toEqual({ taskId: '1' })
    expect(events[2]!.payload).toEqual({ taskId: '3' })
  })

  it('replay with fromStreamId returns events after that ID', async () => {
    const e1 = await store.append('atc:task:queued', { n: 1 }, 'api')
    const e2 = await store.append('atc:task:queued', { n: 2 }, 'api')
    await store.append('atc:task:queued', { n: 3 }, 'api')

    // Replay from e2's streamId
    const events = await store.replay('atc:task:queued', e2.streamId)
    // Should include e2 and e3
    expect(events.length).toBeGreaterThanOrEqual(1)
  })

  it('snapshot returns last N events', async () => {
    for (let i = 0; i < 10; i++) {
      await store.append('atc:task:completed', { n: i }, 'system')
    }
    const snap = await store.snapshot('atc:task:completed', 3)
    expect(snap).toHaveLength(3)
    // Last 3 events (n: 7, 8, 9)
    expect((snap[2]!.payload as { n: number }).n).toBe(9)
  })

  it('prune by maxEvents trims the stream', async () => {
    for (let i = 0; i < 5; i++) {
      await store.append('atc:task:completed', { n: i }, 'system')
    }
    await store.prune('atc:task:completed', { maxEvents: 3 })
    expect(await store.getStreamLength('atc:task:completed')).toBe(3)
  })

  it('prune by maxAgeMs removes old events', async () => {
    // Manually insert an old event via storage
    const storage = new InMemoryEventStoreStorage()
    const s = new AtcEventStore(storage)
    const old = new Date(Date.now() - 10_000).toISOString()
    await storage.append('stream', 'old-id', '{"old":true}', 'sys', old)
    await s.append('stream', { old: false }, 'sys')

    await s.prune('stream', { maxAgeMs: 5_000 })
    expect(await s.getStreamLength('stream')).toBe(1)
  })

  it('handles null and undefined payload gracefully', async () => {
    const e = await store.append('atc:task:queued', null, 'system')
    expect(e.payload).toBeNull()

    const e2 = await store.append('atc:task:queued', undefined, 'system')
    expect(e2.payload).toBeNull()
  })

  it('replay on empty stream returns empty array', async () => {
    const events = await store.replay('non-existent-stream')
    expect(events).toEqual([])
  })

  it('getStreamLength returns 0 for unknown stream', async () => {
    expect(await store.getStreamLength('unknown')).toBe(0)
  })

  it('getAllStreamNames returns all appended streams', async () => {
    await store.append('stream-a', {}, 'system')
    await store.append('stream-b', {}, 'system')
    expect(store.getAllStreamNames()).toEqual(expect.arrayContaining(['stream-a', 'stream-b']))
  })
})
