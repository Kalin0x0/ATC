import { randomUUID } from 'node:crypto'
import type { AtcAuditEvent, AtcPrincipalType } from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'

export interface AtcAuditAppendInput {
  actorId: string
  actorType: AtcPrincipalType
  action: string
  target?: string | null
  sourceInstanceId?: string | null
  result: 'granted' | 'denied' | 'error'
  metadata?: Record<string, unknown>
}

export interface AtcAuditPage {
  events: ReadonlyArray<AtcAuditEvent>
  total: number
  offset: number
  limit: number
}

export interface AtcAuditFilter {
  limit?: number
  offset?: number
  actorId?: string
  action?: string
  result?: 'granted' | 'denied' | 'error'
}

/**
 * Append-only, in-memory audit trail.
 *
 * Events are immutable once appended. The trail is bounded by `maxEvents`
 * (oldest entries evicted) to prevent unbounded memory growth in long-running processes.
 * For durable persistence, callers should also write to the event store or DB.
 */
export class AtcAuditService {
  private readonly _events: AtcAuditEvent[] = []
  private readonly _maxEvents: number
  private _total = 0
  private readonly _telemetry: AtcTelemetryService | undefined

  constructor(options: { maxEvents?: number; telemetry?: AtcTelemetryService } = {}) {
    this._maxEvents = options.maxEvents ?? 10_000
    this._telemetry = options.telemetry
  }

  append(input: AtcAuditAppendInput): AtcAuditEvent {
    const event: AtcAuditEvent = Object.freeze({
      id: randomUUID(),
      actorId: input.actorId,
      actorType: input.actorType,
      action: input.action,
      target: input.target ?? null,
      timestamp: new Date().toISOString(),
      sourceInstanceId: input.sourceInstanceId ?? null,
      result: input.result,
      metadata: Object.freeze({ ...input.metadata }),
    })

    this._events.push(event)
    this._total++

    // Evict oldest when over capacity
    if (this._events.length > this._maxEvents) {
      this._events.shift()
    }

    this._telemetry?.increment('security.audit_events_total')

    return event
  }

  list(filter: AtcAuditFilter = {}): AtcAuditPage {
    const limit = Math.min(filter.limit ?? 50, 200)
    const offset = filter.offset ?? 0

    let filtered = this._events as AtcAuditEvent[]

    if (filter.actorId !== undefined) {
      filtered = filtered.filter((e) => e.actorId === filter.actorId)
    }
    if (filter.action !== undefined) {
      filtered = filtered.filter((e) => e.action === filter.action)
    }
    if (filter.result !== undefined) {
      filtered = filtered.filter((e) => e.result === filter.result)
    }

    const total = filtered.length
    const page = filtered.slice(offset, offset + limit)

    return { events: page, total, offset, limit }
  }

  getTotal(): number {
    return this._total
  }

  /** Returns the number of events currently held in memory (≤ maxEvents). */
  size(): number {
    return this._events.length
  }
}
