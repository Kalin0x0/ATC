import type {
  AtcPluginRecord,
  AtcPluginRuntimeStatus,
  AtcPluginLifecycleMetrics,
  AtcPluginHealthRecord,
  AtcRegistryManifest,
  AtcPluginCapability,
  AtcPluginDependency,
} from '@atc/shared-types'
import { registryManifestSchema } from '@atc/schemas'
import { PluginDuplicateError, PluginNotFoundError, PluginInvalidStatusError } from './errors.js'
import { resolveDependencies } from './resolver.js'

interface InternalPluginRecord {
  id: string
  version: string
  capabilities: AtcPluginCapability[]
  dependencies: AtcPluginDependency[]
  status: AtcPluginRuntimeStatus
  loadedAt: string | null
  lastError: string | null
  health: AtcPluginHealthRecord
  lifecycleMetrics: AtcPluginLifecycleMetrics
  eventsHandled: number
  totalExecutionMs: number
  apiCalls: number
  deniedCalls: number
  registeredAt: string
}

function makeDefaultHealth(): AtcPluginHealthRecord {
  return {
    status: 'healthy',
    failureCount: 0,
    restartCount: 0,
    lastHeartbeat: null,
    lastError: null,
  }
}

function makeDefaultLifecycleMetrics(): AtcPluginLifecycleMetrics {
  return {
    loadTimeMs: 0,
    enableTimeMs: 0,
    disableTimeMs: 0,
    unloadTimeMs: 0,
    reloadCount: 0,
  }
}

function toRecord(r: InternalPluginRecord): AtcPluginRecord {
  return {
    id: r.id,
    version: r.version,
    capabilities: [...r.capabilities],
    dependencies: r.dependencies.map((d) => ({ id: d.id, version: d.version })),
    status: r.status,
    loadedAt: r.loadedAt,
    lastError: r.lastError,
    health: { ...r.health },
    lifecycleMetrics: { ...r.lifecycleMetrics },
  }
}

export class AtcPluginRegistry {
  private readonly _plugins = new Map<string, InternalPluginRecord>()

  validateManifest(manifest: unknown): void {
    registryManifestSchema.parse(manifest)
  }

  register(manifest: AtcRegistryManifest): void {
    const parsed = registryManifestSchema.parse(manifest)

    if (this._plugins.has(parsed.id)) {
      throw new PluginDuplicateError(parsed.id)
    }

    this._plugins.set(parsed.id, {
      id: parsed.id,
      version: parsed.version,
      // Deduplicate capabilities on input — prevents duplicate entries from leaking into records.
      capabilities: [...new Set(parsed.capabilities ?? [])],
      dependencies: parsed.dependencies ?? [],
      status: 'registered',
      loadedAt: null,
      lastError: null,
      health: makeDefaultHealth(),
      lifecycleMetrics: makeDefaultLifecycleMetrics(),
      eventsHandled: 0,
      totalExecutionMs: 0,
      apiCalls: 0,
      deniedCalls: 0,
      registeredAt: new Date().toISOString(),
    })
  }

  unregister(id: string): void {
    const record = this._plugins.get(id)
    if (!record) throw new PluginNotFoundError(id)
    if (record.status === 'active' || record.status === 'loading') {
      throw new PluginInvalidStatusError(id, record.status, 'disabled/registered/failed')
    }
    this._plugins.delete(id)
  }

  get(id: string): AtcPluginRecord | undefined {
    const r = this._plugins.get(id)
    return r ? toRecord(r) : undefined
  }

  getAll(): AtcPluginRecord[] {
    return Array.from(this._plugins.values()).map(toRecord)
  }

  enable(id: string): void {
    this.setStatus(id, 'active')
  }

  disable(id: string, error?: string): void {
    this.setStatus(id, 'disabled', error)
  }

  setStatus(id: string, status: AtcPluginRuntimeStatus, error?: string): void {
    const record = this._plugins.get(id)
    if (!record) throw new PluginNotFoundError(id)

    record.status = status

    if (error !== undefined) {
      record.lastError = error
      record.health.lastError = error
    }

    if (status === 'active') {
      record.loadedAt = new Date().toISOString()
    }
  }

  updateLifecycleMetric(
    id: string,
    key: keyof AtcPluginLifecycleMetrics,
    value: number,
  ): void {
    const record = this._plugins.get(id)
    if (!record) return
    record.lifecycleMetrics[key] = value
  }

  incrementEventsHandled(id: string, durationMs: number): void {
    const record = this._plugins.get(id)
    if (!record) return
    record.eventsHandled++
    record.totalExecutionMs += durationMs
  }

  getAvgExecutionMs(id: string): number {
    const record = this._plugins.get(id)
    if (!record || record.eventsHandled === 0) return 0
    return Math.round((record.totalExecutionMs / record.eventsHandled) * 100) / 100
  }

  getEventsHandled(id: string): number {
    return this._plugins.get(id)?.eventsHandled ?? 0
  }

  has(id: string): boolean {
    return this._plugins.has(id)
  }

  getLoadOrder(): string[] {
    const manifests = Array.from(this._plugins.values()).map((r) => ({
      id: r.id,
      version: r.version,
      capabilities: r.capabilities,
      dependencies: r.dependencies,
    }))
    try {
      return resolveDependencies(manifests).order
    } catch {
      return Array.from(this._plugins.keys())
    }
  }

  resetMetrics(id: string): void {
    const record = this._plugins.get(id)
    if (!record) return
    record.lifecycleMetrics = makeDefaultLifecycleMetrics()
    record.eventsHandled = 0
    record.totalExecutionMs = 0
    record.apiCalls = 0
    record.deniedCalls = 0
  }

  incrementApiCall(id: string): void {
    const record = this._plugins.get(id)
    if (!record) return
    record.apiCalls++
  }

  incrementDeniedCall(id: string): void {
    const record = this._plugins.get(id)
    if (!record) return
    record.deniedCalls++
  }

  getApiCalls(id: string): number {
    return this._plugins.get(id)?.apiCalls ?? 0
  }

  getDeniedCalls(id: string): number {
    return this._plugins.get(id)?.deniedCalls ?? 0
  }

  getUptimeMs(id: string): number {
    const record = this._plugins.get(id)
    if (!record) return 0
    return Date.now() - new Date(record.registeredAt).getTime()
  }
}
