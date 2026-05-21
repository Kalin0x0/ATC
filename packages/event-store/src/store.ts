import { randomUUID } from 'node:crypto'
import type { AtcStoredEvent, AtcEventRetentionPolicy, AtcStoredEventSummary, AtcEventPage } from '@atc/shared-types'

type StorageEntry = { streamId: string; id: string; payload: string; source: string; storedAt: string; sourceInstanceId?: string }

// Injectable storage interface — Redis Streams or in-memory for testing
export interface EventStoreStorage {
  append(streamKey: string, id: string, payload: string, source: string, storedAt: string, sourceInstanceId?: string): Promise<string>
  range(streamKey: string, start: string, end: string, count: number): Promise<StorageEntry[]>
  trimByCount(streamKey: string, maxLen: number): Promise<void>
  trimByAge(streamKey: string, minStoredAt: string): Promise<void>
  len(streamKey: string): Promise<number>
  allStreamKeys(): string[]
}

export class InMemoryEventStoreStorage implements EventStoreStorage {
  private readonly _streams = new Map<string, StorageEntry[]>()

  async append(streamKey: string, id: string, payload: string, source: string, storedAt: string, sourceInstanceId?: string): Promise<string> {
    const stream = this._streams.get(streamKey) ?? []
    const streamId = `${Date.now()}-${stream.length}`
    const entry: StorageEntry = { streamId, id, payload, source, storedAt }
    if (sourceInstanceId !== undefined) entry.sourceInstanceId = sourceInstanceId
    stream.push(entry)
    this._streams.set(streamKey, stream)
    return streamId
  }

  async range(streamKey: string, start: string, _end: string, count: number): Promise<StorageEntry[]> {
    const stream = this._streams.get(streamKey) ?? []
    // start='0' means from beginning; otherwise filter by streamId >= start
    const filtered = start === '0'
      ? stream
      : stream.filter((e) => e.streamId >= start)
    return filtered.slice(0, count)
  }

  async trimByCount(streamKey: string, maxLen: number): Promise<void> {
    const stream = this._streams.get(streamKey)
    if (!stream || stream.length <= maxLen) return
    this._streams.set(streamKey, stream.slice(stream.length - maxLen))
  }

  async trimByAge(streamKey: string, minStoredAt: string): Promise<void> {
    const stream = this._streams.get(streamKey)
    if (!stream) return
    this._streams.set(streamKey, stream.filter((e) => e.storedAt >= minStoredAt))
  }

  async len(streamKey: string): Promise<number> {
    return this._streams.get(streamKey)?.length ?? 0
  }

  allStreamKeys(): string[] {
    return Array.from(this._streams.keys())
  }
}

// Minimal Redis Streams interface — satisfied by ioredis Redis client
export interface RedisStreamLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  xadd(key: string, id: string, ...fieldValues: string[]): Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call(command: string, ...args: string[]): Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  xlen(key: string): Promise<any>
}

export class RedisEventStoreStorage implements EventStoreStorage {
  private readonly _seenKeys = new Set<string>()
  private static readonly STREAM_PREFIX = 'atc:events:stream:'

  constructor(private readonly _redis: RedisStreamLike) {}

  private _key(streamKey: string): string {
    return `${RedisEventStoreStorage.STREAM_PREFIX}${streamKey}`
  }

  async append(streamKey: string, id: string, payload: string, source: string, storedAt: string, sourceInstanceId?: string): Promise<string> {
    this._seenKeys.add(streamKey)
    const key = this._key(streamKey)
    const extra = sourceInstanceId !== undefined ? ['sourceInstanceId', sourceInstanceId] : []
    const streamId = await this._redis.xadd(key, '*', 'id', id, 'payload', payload, 'source', source, 'storedAt', storedAt, ...extra) as string | null
    return streamId ?? `${Date.now()}-0`
  }

  async range(streamKey: string, start: string, end: string, count: number): Promise<StorageEntry[]> {
    const key = this._key(streamKey)
    // ioredis xrange signature: xrange(key, start, end, 'COUNT', count)
    const entries = await this._redis.call('XRANGE', key, start, end, 'COUNT', String(count)) as Array<[string, string[]]> | null
    if (!entries) return []
    return entries.map(([streamId, fields]) => {
      const fieldMap: Record<string, string> = {}
      for (let i = 0; i < fields.length - 1; i += 2) {
        fieldMap[fields[i]!] = fields[i + 1]!
      }
      const entry: StorageEntry = {
        streamId,
        id: fieldMap['id'] ?? '',
        payload: fieldMap['payload'] ?? '{}',
        source: fieldMap['source'] ?? 'unknown',
        storedAt: fieldMap['storedAt'] ?? new Date().toISOString(),
      }
      if (fieldMap['sourceInstanceId'] !== undefined) entry.sourceInstanceId = fieldMap['sourceInstanceId']
      return entry
    })
  }

  async trimByCount(streamKey: string, maxLen: number): Promise<void> {
    await this._redis.call('XTRIM', this._key(streamKey), 'MAXLEN', String(maxLen))
  }

  async trimByAge(_streamKey: string, _minStoredAt: string): Promise<void> {
    // Age-based trim via MINID requires Redis 6.2+. Deferred to Phase 16.
  }

  async len(streamKey: string): Promise<number> {
    return (await this._redis.xlen(this._key(streamKey))) as number
  }

  allStreamKeys(): string[] {
    return Array.from(this._seenKeys)
  }
}

export class AtcEventStore {
  constructor(private readonly _storage: EventStoreStorage) {}

  async append(
    eventName: string,
    payload: unknown,
    source: string,
    sourceInstanceId?: string,
  ): Promise<AtcStoredEvent> {
    const id = randomUUID()
    const storedAt = new Date().toISOString()
    const payloadStr = this._serializePayload(payload)

    const streamId = await this._storage.append(eventName, id, payloadStr, source, storedAt, sourceInstanceId)

    const event: AtcStoredEvent = { id, streamId, eventName, payload: payload ?? null, source, storedAt }
    if (sourceInstanceId !== undefined) event.sourceInstanceId = sourceInstanceId
    return event
  }

  async replay(
    eventName: string,
    fromStreamId = '0',
    limit = 100,
  ): Promise<AtcStoredEvent[]> {
    const entries = await this._storage.range(eventName, fromStreamId, '+', Math.min(limit, 1000))
    return entries.map((e) => {
      const event: AtcStoredEvent = {
        id: e.id,
        streamId: e.streamId,
        eventName,
        payload: this._deserializePayload(e.payload),
        source: e.source,
        storedAt: e.storedAt,
      }
      if (e.sourceInstanceId !== undefined) event.sourceInstanceId = e.sourceInstanceId
      return event
    })
  }

  async snapshot(eventName: string, limit = 50): Promise<AtcStoredEvent[]> {
    // Returns the last N events
    const total = await this._storage.len(eventName)
    if (total === 0) return []
    return this.replay(eventName, '0', total).then((events) =>
      events.slice(-Math.min(limit, events.length)),
    )
  }

  async prune(eventName: string, policy: AtcEventRetentionPolicy): Promise<void> {
    if (policy.maxEvents !== undefined) {
      await this._storage.trimByCount(eventName, policy.maxEvents)
    }
    if (policy.maxAgeMs !== undefined) {
      const minStoredAt = new Date(Date.now() - policy.maxAgeMs).toISOString()
      await this._storage.trimByAge(eventName, minStoredAt)
    }
  }

  async getStreamLength(eventName: string): Promise<number> {
    return this._storage.len(eventName)
  }

  getAllStreamNames(): string[] {
    return this._storage.allStreamKeys()
  }

  async listEvents(opts: { eventName?: string; limit?: number; cursor?: string } = {}): Promise<AtcEventPage> {
    const limit = Math.min(opts.limit ?? 50, 200)

    if (opts.eventName) {
      // Single-stream cursor: the streamId of the last entry seen
      const fromStreamId = opts.cursor ?? '0'
      const entries = await this._storage.range(opts.eventName, fromStreamId === '0' ? '0' : fromStreamId, '+', limit + 1)
      // When resuming from cursor, skip the entry with that exact streamId (already seen)
      const filtered = fromStreamId !== '0' ? entries.filter((e) => e.streamId > fromStreamId) : entries
      const page = filtered.slice(0, limit)
      const nextCursor = page.length === limit && filtered.length > limit ? (page[page.length - 1]?.streamId ?? null) : null
      return {
        events: page.map((e) => ({ id: e.id, streamId: e.streamId, eventName: opts.eventName!, source: e.source, storedAt: e.storedAt })),
        nextCursor,
      }
    }

    // Multi-stream: load from all streams, sort by storedAt, paginate by offset cursor
    const offset = opts.cursor ? parseInt(Buffer.from(opts.cursor, 'base64url').toString(), 10) : 0
    const streamKeys = this._storage.allStreamKeys()
    const all: AtcStoredEventSummary[] = []
    await Promise.all(
      streamKeys.map(async (key) => {
        const entries = await this._storage.range(key, '0', '+', 10_000)
        for (const e of entries) {
          all.push({ id: e.id, streamId: e.streamId, eventName: key, source: e.source, storedAt: e.storedAt })
        }
      }),
    )
    all.sort((a, b) => a.storedAt.localeCompare(b.storedAt))
    const page = all.slice(offset, offset + limit)
    const nextOffset = offset + limit
    const nextCursor = nextOffset < all.length ? Buffer.from(String(nextOffset)).toString('base64url') : null
    return { events: page, nextCursor }
  }

  async getEvent(eventId: string): Promise<AtcStoredEvent | null> {
    const streamKeys = this._storage.allStreamKeys()
    for (const key of streamKeys) {
      const entries = await this._storage.range(key, '0', '+', 10_000)
      const found = entries.find((e) => e.id === eventId)
      if (found) {
        const event: AtcStoredEvent = {
          id: found.id,
          streamId: found.streamId,
          eventName: key,
          payload: this._deserializePayload(found.payload),
          source: found.source,
          storedAt: found.storedAt,
        }
        if (found.sourceInstanceId !== undefined) event.sourceInstanceId = found.sourceInstanceId
        return event
      }
    }
    return null
  }

  private _serializePayload(payload: unknown): string {
    try {
      return JSON.stringify(payload ?? null)
    } catch {
      return 'null'
    }
  }

  private _deserializePayload(str: string): unknown {
    try {
      return JSON.parse(str) as unknown
    } catch {
      return null
    }
  }
}
