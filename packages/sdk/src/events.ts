import { EventEmitter } from 'node:events'
import type {
  AtcEventEnvelope,
  AtcEventHandler,
  AtcEventRegistration,
} from '@atc/shared-types'
import {
  ATC_CORE_EVENTS,
  ATC_PLAYER_EVENTS,
  ATC_SECURITY_EVENTS,
  ATC_LOCALE_EVENTS,
} from '@atc/shared-types'

export class AtcEventBus extends EventEmitter {
  private readonly _registry = new Map<string, AtcEventRegistration>()

  register(registration: AtcEventRegistration): void {
    this._registry.set(registration.eventName, registration)
  }

  getRegistration(eventName: string): AtcEventRegistration | undefined {
    return this._registry.get(eventName)
  }

  isRegistered(eventName: string): boolean {
    return this._registry.has(eventName)
  }

  getAllRegistrations(): AtcEventRegistration[] {
    return Array.from(this._registry.values())
  }

  emit<TPayload>(eventName: string, envelope: AtcEventEnvelope<TPayload>): boolean {
    return super.emit(eventName, envelope)
  }

  on<TPayload>(
    eventName: string,
    handler: AtcEventHandler<TPayload>
  ): this {
    return super.on(eventName, (envelope: AtcEventEnvelope<TPayload>) => {
      void handler(envelope._source ?? 0, envelope.payload, envelope)
    })
  }

  once<TPayload>(
    eventName: string,
    handler: AtcEventHandler<TPayload>
  ): this {
    return super.once(eventName, (envelope: AtcEventEnvelope<TPayload>) => {
      void handler(envelope._source ?? 0, envelope.payload, envelope)
    })
  }
}

export function buildEventEnvelope<TPayload>(
  eventName: string,
  payload: TPayload,
  source?: number
): AtcEventEnvelope<TPayload> {
  return {
    _version: 1,
    _timestamp: Date.now(),
    _traceId: generateTraceId(),
    _event: eventName,
    _source: source ?? null,
    payload,
  }
}

function generateTraceId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(13)))
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 26)
    .toUpperCase()
}

export const ATC_EVENTS = {
  ...ATC_CORE_EVENTS,
  ...ATC_PLAYER_EVENTS,
  ...ATC_SECURITY_EVENTS,
  ...ATC_LOCALE_EVENTS,
} as const

export type AtcEventName = typeof ATC_EVENTS[keyof typeof ATC_EVENTS]
