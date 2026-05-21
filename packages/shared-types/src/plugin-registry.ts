import type { AtcPluginCapability } from './plugin-runtime.js'
import type { AtcPluginServiceContainer } from './plugin-runtime-api.js'

export type AtcPluginRuntimeStatus =
  | 'registered'
  | 'loading'
  | 'active'
  | 'disabled'
  | 'failed'
  | 'unloading'
  | 'restarting'
  | 'stopped'

export type AtcPluginHealthStatus = 'healthy' | 'degraded' | 'failed'

export interface AtcPluginDependency {
  id: string
  version: string
}

export interface AtcPluginLifecycleMetrics {
  loadTimeMs: number
  enableTimeMs: number
  disableTimeMs: number
  unloadTimeMs: number
  reloadCount: number
}

export interface AtcPluginHealthRecord {
  status: AtcPluginHealthStatus
  failureCount: number
  restartCount: number
  lastHeartbeat: string | null
  lastError: string | null
}

export interface AtcPluginRecord {
  id: string
  version: string
  capabilities: AtcPluginCapability[]
  dependencies: AtcPluginDependency[]
  status: AtcPluginRuntimeStatus
  loadedAt: string | null
  lastError: string | null
  health: AtcPluginHealthRecord
  lifecycleMetrics: AtcPluginLifecycleMetrics
}

export interface AtcRegistryManifest {
  id: string
  version: string
  capabilities?: AtcPluginCapability[]
  dependencies?: AtcPluginDependency[]
}

export interface AtcPluginHooks {
  onSetup?(container: AtcPluginServiceContainer): Promise<void> | void
  onLoad?(): Promise<void> | void
  onEnable?(): Promise<void> | void
  onDisable?(): Promise<void> | void
  onUnload?(): Promise<void> | void
  onError?(err: Error): Promise<void> | void
}

export interface AtcPluginLogger {
  info(msg: string, data?: Record<string, unknown>): void
  warn(msg: string, data?: Record<string, unknown>): void
  error(msg: string, data?: Record<string, unknown>): void
  debug(msg: string, data?: Record<string, unknown>): void
}

export interface AtcPluginPersistedState {
  pluginId: string
  enabled: boolean
  crashCount: number
  lastLoadedAt: string | null
  settings: Record<string, unknown>
}

export interface AtcPluginMetricsSnapshot {
  id: string
  status: AtcPluginRuntimeStatus
  healthStatus: AtcPluginHealthStatus
  restartCount: number
  failures: number
  eventsHandled: number
  avgExecutionMs: number
  lastError: string | null
}

export interface AtcPluginResourceUsage {
  activeTimers: number
  activeIntervals: number
  activeSubscriptions: number
  activeWorkers: number
  estimatedMemoryBytes: number
}

export interface AtcPluginHealthSnapshot {
  pluginId: string
  state: AtcPluginRuntimeStatus
  healthy: boolean
  uptimeMs: number
  restartCount: number
  crashCount: number
  lastError: string | null
  lastCrashAt: string | null
  resourceUsage: AtcPluginResourceUsage
  capturedAt: string
}
