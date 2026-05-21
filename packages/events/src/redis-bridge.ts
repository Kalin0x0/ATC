import { randomUUID } from 'node:crypto'
import type { AtcDistributedEventEnvelope, AtcRedisConnectionState } from '@atc/shared-types'

const CHANNEL_PREFIX = 'atc:events:'
const DEDUP_TTL_MS = 60_000
const DEDUP_CLEANUP_INTERVAL_MS = 120_000

export type AtcBridgeHandler = (payload: unknown) => void | Promise<void>

// Duck-typed Redis interface satisfied by ioredis
export interface BridgeRedisLike {
  publish(channel: string, message: string): Promise<number>
  subscribe(...channels: string[]): Promise<unknown>
  unsubscribe(...channels: string[]): Promise<unknown>
  duplicate(): BridgeRedisLike
  on(event: 'message', listener: (channel: string, message: string) => void): this
  on(event: 'connect' | 'ready' | 'error' | 'close' | 'end' | 'reconnecting', listener: (...args: unknown[]) => void): this
  quit(): Promise<string>
}

export class AtcRedisEventBridge {
  private readonly _pub: BridgeRedisLike
  private readonly _sub: BridgeRedisLike
  private readonly _subscriptions = new Map<string, AtcBridgeHandler[]>()
  private readonly _nodeId: string
  private _closed = false
  private _state: AtcRedisConnectionState = 'connected'

  // In-process event-level deduplication: eventId → expiry timestamp
  private readonly _seen = new Map<string, number>()
  private _cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(redis: BridgeRedisLike, nodeId?: string) {
    this._pub = redis
    this._sub = redis.duplicate()
    this._nodeId = nodeId ?? process.env['ATC_NODE_ID'] ?? 'default'

    this._sub.on('message', (channel: string, raw: string) => {
      void this._handleMessage(channel, raw)
    })

    // Reconnect handling — auto-resubscribe all channels when Redis reconnects
    this._sub.on('reconnecting', () => {
      this._state = 'reconnecting'
    })

    this._sub.on('ready', () => {
      this._state = 'connected'
      this._resubscribeAll()
    })

    this._sub.on('error', () => {
      if (this._state === 'connected') {
        this._state = 'degraded'
      }
    })

    this._sub.on('end', () => {
      if (!this._closed) {
        this._state = 'failed'
      }
    })

    // Periodic cleanup of expired dedup entries
    this._cleanupTimer = setInterval(() => this._cleanupSeen(), DEDUP_CLEANUP_INTERVAL_MS)
    if (this._cleanupTimer.unref) this._cleanupTimer.unref()
  }

  get connectionState(): AtcRedisConnectionState {
    return this._state
  }

  async publish(eventName: string, payload: unknown): Promise<void> {
    if (this._closed) return
    const envelope: AtcDistributedEventEnvelope = {
      eventId: randomUUID(),
      sourceNodeId: this._nodeId,
      emittedAt: new Date().toISOString(),
      eventName,
      payload,
    }
    try {
      await this._pub.publish(`${CHANNEL_PREFIX}${eventName}`, JSON.stringify(envelope))
    } catch {
      // Redis publish failures are non-fatal — local handlers already ran
    }
  }

  subscribe(eventName: string, handler: AtcBridgeHandler): void {
    const list = this._subscriptions.get(eventName) ?? []
    if (list.includes(handler)) return
    const isNewChannel = list.length === 0
    list.push(handler)
    this._subscriptions.set(eventName, list)
    if (isNewChannel && !this._closed) {
      this._sub.subscribe(`${CHANNEL_PREFIX}${eventName}`).catch(() => undefined)
    }
  }

  unsubscribe(eventName: string, handler: AtcBridgeHandler): void {
    const list = this._subscriptions.get(eventName)
    if (!list) return
    const updated = list.filter((h) => h !== handler)
    if (updated.length === 0) {
      this._subscriptions.delete(eventName)
      if (!this._closed) {
        this._sub.unsubscribe(`${CHANNEL_PREFIX}${eventName}`).catch(() => undefined)
      }
    } else {
      this._subscriptions.set(eventName, updated)
    }
  }

  async close(): Promise<void> {
    if (this._closed) return
    this._closed = true
    this._state = 'failed'
    if (this._cleanupTimer !== null) {
      clearInterval(this._cleanupTimer)
      this._cleanupTimer = null
    }
    await this._sub.quit().catch(() => undefined)
  }

  getSubscribedEvents(): string[] {
    return Array.from(this._subscriptions.keys())
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  private _handleMessage(channel: string, raw: string): void {
    if (!channel.startsWith(CHANNEL_PREFIX)) return
    const eventName = channel.slice(CHANNEL_PREFIX.length)
    const handlers = this._subscriptions.get(eventName)
    if (!handlers || handlers.length === 0) return

    let envelope: AtcDistributedEventEnvelope
    try {
      envelope = JSON.parse(raw) as AtcDistributedEventEnvelope
    } catch {
      return
    }

    if (typeof envelope !== 'object' || envelope === null) return

    // Drop events originating from this node (loop prevention)
    if (envelope.sourceNodeId === this._nodeId) return

    // Event-level deduplication
    if (this._isDuplicate(envelope.eventId)) return

    const payload = envelope.payload
    for (const handler of handlers) {
      Promise.resolve(handler(payload)).catch(() => undefined)
    }
  }

  private _isDuplicate(eventId: string): boolean {
    const now = Date.now()
    const expiry = this._seen.get(eventId)
    if (expiry !== undefined && now < expiry) return true
    this._seen.set(eventId, now + DEDUP_TTL_MS)
    return false
  }

  private _resubscribeAll(): void {
    for (const eventName of this._subscriptions.keys()) {
      this._sub.subscribe(`${CHANNEL_PREFIX}${eventName}`).catch(() => undefined)
    }
  }

  private _cleanupSeen(): void {
    const now = Date.now()
    for (const [id, expiry] of this._seen) {
      if (now >= expiry) this._seen.delete(id)
    }
  }
}
