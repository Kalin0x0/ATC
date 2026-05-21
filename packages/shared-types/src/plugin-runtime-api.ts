import type { AtcCharacterVitals, AtcVitalsPatch } from './vitals.js'
import type { AtcInventorySlot } from './inventory.js'
import type { AtcWallet } from './wallet.js'
import type { AtcStatusEffect, AtcApplyStatusEffectRequest } from './status-effects.js'
import type { AtcPluginLogger, AtcPluginMetricsSnapshot } from './plugin-registry.js'
import type { AtcPluginTasksApi } from './task-runtime.js'

export type { AtcPluginTasksApi }

export interface AtcPluginApiResult<T = void> {
  ok: boolean
  data?: T
  error?: string
}

export interface AtcPluginCleanupRegistrar {
  onCleanup(fn: () => void): void
  scheduleTimeout(fn: () => void, ms: number): void
  scheduleInterval(fn: () => void, ms: number): void
  dispose(): void
  activeTimers(): number
  activeIntervals(): number
}

export interface AtcPluginVitalsApi {
  read(characterId: string): Promise<AtcPluginApiResult<AtcCharacterVitals>>
  mutate(characterId: string, patch: AtcVitalsPatch): Promise<AtcPluginApiResult<AtcCharacterVitals>>
}

export interface AtcPluginInventoryApi {
  read(characterId: string): Promise<AtcPluginApiResult<readonly AtcInventorySlot[]>>
  add(
    characterId: string,
    itemId: string,
    quantity: number,
    metadata?: Record<string, unknown>,
  ): Promise<AtcPluginApiResult<void>>
  remove(characterId: string, itemId: string, quantity: number): Promise<AtcPluginApiResult<void>>
}

export interface AtcPluginWalletApi {
  balance(characterId: string): Promise<AtcPluginApiResult<AtcWallet>>
  credit(characterId: string, amount: number, reason: string): Promise<AtcPluginApiResult<AtcWallet>>
  debit(characterId: string, amount: number, reason: string): Promise<AtcPluginApiResult<AtcWallet>>
}

export interface AtcPluginStatusEffectsApi {
  read(characterId: string): Promise<AtcPluginApiResult<readonly AtcStatusEffect[]>>
  apply(characterId: string, request: AtcApplyStatusEffectRequest): Promise<AtcPluginApiResult<void>>
  clear(characterId: string, type: string): Promise<AtcPluginApiResult<void>>
}

export interface AtcPluginEventsApi {
  on(event: string, handler: (payload: unknown) => void): void
  once(event: string, handler: (payload: unknown) => void): void
  off(event: string, handler: (payload: unknown) => void): void
  emit(event: string, payload?: unknown): Promise<AtcPluginApiResult<void>>
}

export interface AtcPluginTelemetryApi {
  record(name: string, value: number, kind?: 'counter' | 'gauge' | 'histogram'): void
  time<T>(name: string, fn: () => Promise<T>): Promise<T>
}

export interface AtcPluginServiceContainer {
  readonly pluginId: string
  readonly logger: AtcPluginLogger
  readonly cleanup: AtcPluginCleanupRegistrar
  readonly eventsApi: AtcPluginEventsApi
  readonly telemetryApi: AtcPluginTelemetryApi
  readonly vitalsApi: AtcPluginVitalsApi | undefined
  readonly inventoryApi: AtcPluginInventoryApi | undefined
  readonly walletApi: AtcPluginWalletApi | undefined
  readonly statusEffectsApi: AtcPluginStatusEffectsApi | undefined
  readonly tasksApi: AtcPluginTasksApi | undefined
}

export interface AtcPluginExtendedMetrics extends AtcPluginMetricsSnapshot {
  apiCalls: number
  deniedCalls: number
  activeSubscriptions: number
  activeTimers: number
  uptimeMs: number
}
