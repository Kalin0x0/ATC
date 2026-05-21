import type {
  AtcPluginServiceContainer,
  AtcPluginCapability,
  AtcPluginLogger,
  AtcPluginVitalsApi,
  AtcPluginInventoryApi,
  AtcPluginWalletApi,
  AtcPluginStatusEffectsApi,
  AtcPluginTasksApi,
  AtcCharacterVitals,
  AtcVitalsPatch,
  AtcInventorySlot,
  AtcWallet,
  AtcStatusEffect,
  AtcApplyStatusEffectRequest,
} from '@atc/shared-types'
import type { AtcPluginRegistry, AtcPluginScopedEventBus } from '@atc/plugin-registry'
import type { AtcTelemetryService } from '@atc/telemetry'
import { PluginCleanupManager } from './cleanup.js'
import { PluginEventsApi } from './apis/events.api.js'
import { PluginTelemetryApi } from './apis/telemetry.api.js'
import { PluginVitalsApi } from './apis/vitals.api.js'
import { PluginInventoryApi } from './apis/inventory.api.js'
import { PluginWalletApi } from './apis/wallet.api.js'
import { PluginStatusEffectsApi } from './apis/status-effects.api.js'

// Duck-typed task runtime interface — avoids circular dep (task-runtime ↔ plugin-runtime-api)
export type TaskRuntimeLike = {
  enqueue(opts: { type: string; payload?: unknown; pluginId?: string | null; queueName?: string; maxRetries?: number; timeoutMs?: number }): Promise<string>
  schedule(opts: { type: string; payload?: unknown; delayMs: number; pluginId?: string | null; queueName?: string; maxRetries?: number; timeoutMs?: number }): Promise<string>
}

class PluginTasksApiImpl implements AtcPluginTasksApi {
  constructor(
    private readonly _pluginId: string,
    private readonly _capabilities: ReadonlyArray<AtcPluginCapability>,
    private readonly _runtime: TaskRuntimeLike,
    private readonly _registry: AtcPluginRegistry,
  ) {}

  async enqueue(
    type: string,
    payload: unknown,
    opts?: { maxRetries?: number; timeoutMs?: number },
  ) {
    if (!this._capabilities.includes('tasks.enqueue')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return { ok: false as const, error: 'Permission denied: tasks.enqueue required' }
    }
    try {
      const taskId = await this._runtime.enqueue({
        type,
        payload,
        pluginId: this._pluginId,
        queueName: `atc:tasks:plugin:${this._pluginId}`,
        ...(opts?.maxRetries !== undefined && { maxRetries: opts.maxRetries }),
        ...(opts?.timeoutMs !== undefined && { timeoutMs: opts.timeoutMs }),
      })
      this._registry.incrementApiCall(this._pluginId)
      return { ok: true as const, data: taskId }
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async schedule(
    type: string,
    payload: unknown,
    delayMs: number,
    opts?: { maxRetries?: number; timeoutMs?: number },
  ) {
    if (!this._capabilities.includes('tasks.schedule')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return { ok: false as const, error: 'Permission denied: tasks.schedule required' }
    }
    try {
      const taskId = await this._runtime.schedule({
        type,
        payload,
        delayMs: Math.max(0, Math.min(delayMs, 86_400_000)),
        pluginId: this._pluginId,
        queueName: `atc:tasks:plugin:${this._pluginId}`,
        ...(opts?.maxRetries !== undefined && { maxRetries: opts.maxRetries }),
        ...(opts?.timeoutMs !== undefined && { timeoutMs: opts.timeoutMs }),
      })
      this._registry.incrementApiCall(this._pluginId)
      return { ok: true as const, data: taskId }
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

// Duck-typed service interfaces — concrete repository/cache types satisfy these
export interface VitalsServiceLike {
  get(characterId: string): Promise<AtcCharacterVitals | undefined>
  mutate(
    characterId: string,
    patch: AtcVitalsPatch,
    source: string,
    actor: string,
  ): Promise<AtcCharacterVitals>
}

export interface InventoryServiceLike {
  getSlots(characterId: string): Promise<AtcInventorySlot[]>
  addItem(
    characterId: string,
    itemId: string,
    quantity: number,
    metadata?: Record<string, unknown>,
  ): Promise<void>
  removeItem(characterId: string, itemId: string, quantity: number): Promise<void>
}

export interface WalletServiceLike {
  getWallet(characterId: string): Promise<AtcWallet | undefined>
  credit(characterId: string, amount: number, reason: string, source: string): Promise<AtcWallet>
  debit(characterId: string, amount: number, reason: string, source: string): Promise<AtcWallet>
}

export interface StatusEffectsServiceLike {
  getEffects(characterId: string): Promise<AtcStatusEffect[]>
  applyEffect(characterId: string, request: AtcApplyStatusEffectRequest): Promise<void>
  clearEffect(characterId: string, type: string): Promise<void>
}

export interface PluginServiceContainerOptions {
  pluginId: string
  capabilities: ReadonlyArray<AtcPluginCapability>
  logger: AtcPluginLogger
  registry: AtcPluginRegistry
  scopedEventBus: AtcPluginScopedEventBus
  telemetry: AtcTelemetryService
  vitalsService?: VitalsServiceLike
  inventoryService?: InventoryServiceLike
  walletService?: WalletServiceLike
  statusEffectsService?: StatusEffectsServiceLike
  taskRuntime?: TaskRuntimeLike
}

export function createPluginServiceContainer(
  opts: PluginServiceContainerOptions,
): AtcPluginServiceContainer {
  const {
    pluginId,
    capabilities,
    logger,
    registry,
    scopedEventBus,
    telemetry,
    vitalsService,
    inventoryService,
    walletService,
    statusEffectsService,
    taskRuntime,
  } = opts

  const cleanup = new PluginCleanupManager()
  const eventsApi = new PluginEventsApi(pluginId, capabilities, scopedEventBus, registry)
  const telemetryApi = new PluginTelemetryApi(pluginId, capabilities, telemetry, registry)

  const hasVitalsRead = capabilities.includes('vitals.read') || capabilities.includes('vitals.write')
  const vitalsApi: AtcPluginVitalsApi | undefined =
    hasVitalsRead && vitalsService
      ? new PluginVitalsApi(pluginId, capabilities, vitalsService, registry)
      : undefined

  const hasInventoryRead = capabilities.includes('inventory.read') || capabilities.includes('inventory.write')
  const inventoryApi: AtcPluginInventoryApi | undefined =
    hasInventoryRead && inventoryService
      ? new PluginInventoryApi(pluginId, capabilities, inventoryService, registry)
      : undefined

  const hasWalletRead = capabilities.includes('wallet.read') || capabilities.includes('wallet.write')
  const walletApi: AtcPluginWalletApi | undefined =
    hasWalletRead && walletService
      ? new PluginWalletApi(pluginId, capabilities, walletService, registry)
      : undefined

  const hasStatusRead = capabilities.includes('status.read') || capabilities.includes('status.write')
  const statusEffectsApi: AtcPluginStatusEffectsApi | undefined =
    hasStatusRead && statusEffectsService
      ? new PluginStatusEffectsApi(pluginId, capabilities, statusEffectsService, registry)
      : undefined

  const hasTasksAccess = capabilities.includes('tasks.enqueue') || capabilities.includes('tasks.schedule')
  const tasksApi: AtcPluginTasksApi | undefined =
    hasTasksAccess && taskRuntime
      ? new PluginTasksApiImpl(pluginId, capabilities, taskRuntime, registry)
      : undefined

  return Object.freeze({
    pluginId,
    logger,
    cleanup,
    eventsApi,
    telemetryApi,
    vitalsApi,
    inventoryApi,
    walletApi,
    statusEffectsApi,
    tasksApi,
  })
}
