export { PluginCleanupManager } from './cleanup.js'
export { createPluginServiceContainer } from './container.js'
export type {
  PluginServiceContainerOptions,
  VitalsServiceLike,
  InventoryServiceLike,
  WalletServiceLike,
  StatusEffectsServiceLike,
} from './container.js'
export { PluginVitalsApi } from './apis/vitals.api.js'
export { PluginInventoryApi } from './apis/inventory.api.js'
export { PluginWalletApi } from './apis/wallet.api.js'
export { PluginStatusEffectsApi } from './apis/status-effects.api.js'
export { PluginEventsApi } from './apis/events.api.js'
export { PluginTelemetryApi } from './apis/telemetry.api.js'

// Task runtime integration type (duck-typed to avoid circular dependency)
export type { TaskRuntimeLike } from './container.js'
