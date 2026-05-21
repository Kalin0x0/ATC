export interface AtcEventEnvelope<TPayload = unknown> {
  _version: number
  _timestamp: number
  _traceId: string
  _event: string
  _source: number | null
  payload: TPayload
}

export interface AtcClientEventRequest<TPayload = unknown> {
  payload: TPayload
}

export interface AtcEventRegistration {
  eventName: string
  clientAllowed: boolean
  requireSession: boolean
  rateLimit: AtcRateLimitConfig
  schemaId?: string
}

export interface AtcRateLimitConfig {
  windowMs: number
  max: number
}

export type AtcEventHandler<TPayload = unknown> = (
  source: number,
  payload: TPayload,
  envelope: AtcEventEnvelope<TPayload>
) => void | Promise<void>

export const ATC_CORE_EVENTS = {
  CLIENT_READY: 'atc:core:client:ready',
  SERVER_READY: 'atc:core:server:ready',
  PLUGIN_READY: 'atc:core:plugin:ready',
  SERVER_STARTED: 'atc:core:server:started',
} as const

export const ATC_PLAYER_EVENTS = {
  CONNECTED: 'atc:player:connected',
  DISCONNECTED: 'atc:player:disconnected',
  CHARACTER_SELECTED: 'atc:player:character:selected',
  CHARACTER_CREATED: 'atc:player:character:created',
  REQUEST_RESPAWN: 'atc:player:request:respawn',
  REQUEST_CHARACTER_SELECT: 'atc:player:request:character_select',
} as const

export const ATC_SECURITY_EVENTS = {
  VIOLATION_DETECTED: 'atc:security:violation:detected',
  RATELIMIT_EXCEEDED: 'atc:security:ratelimit:exceeded',
  BAN_ISSUED: 'atc:security:ban:issued',
  BAN_CHECKED: 'atc:security:ban:checked',
  // Phase 19 — IAM/authorization events
  AUTH_GRANTED: 'atc:security:auth:granted',
  AUTH_DENIED: 'atc:security:auth:denied',
  ROLE_ASSIGNED: 'atc:security:role:assigned',
  ROLE_REVOKED: 'atc:security:role:revoked',
  CAPABILITY_GRANTED: 'atc:security:capability:granted',
  CAPABILITY_DENIED: 'atc:security:capability:denied',
  // Phase 20 — Principal lifecycle events
  PRINCIPAL_CREATED: 'atc:security:principal:created',
  PRINCIPAL_UPDATED: 'atc:security:principal:updated',
  PRINCIPAL_DISABLED: 'atc:security:principal:disabled',
  CAPABILITY_REVOKED: 'atc:security:capability:revoked',
} as const

export const ATC_LOCALE_EVENTS = {
  REQUEST: 'atc:locale:request',
  LOADED: 'atc:locale:loaded',
} as const

export const ATC_ECONOMY_EVENTS = {
  TRANSFER_COMPLETED: 'atc:economy:transfer:completed',
  INVOICE_ISSUED: 'atc:economy:invoice:issued',
  INVOICE_PAID: 'atc:economy:invoice:paid',
  ACCOUNT_FROZEN: 'atc:economy:account:frozen',
  ORGANIZATION_CREATED: 'atc:economy:organization:created',
} as const

export type AtcCoreEventName = typeof ATC_CORE_EVENTS[keyof typeof ATC_CORE_EVENTS]
export type AtcPlayerEventName = typeof ATC_PLAYER_EVENTS[keyof typeof ATC_PLAYER_EVENTS]
export type AtcSecurityEventName = typeof ATC_SECURITY_EVENTS[keyof typeof ATC_SECURITY_EVENTS]
export type AtcEconomyEventName = typeof ATC_ECONOMY_EVENTS[keyof typeof ATC_ECONOMY_EVENTS]
