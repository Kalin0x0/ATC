import type { AtcPluginHealthRecord, AtcPluginHealthStatus } from '@atc/shared-types'

export interface AtcPluginHealthMonitorOptions {
  maxFailures?: number
  degradeThreshold?: number
}

export interface FailureResult {
  shouldDisable: boolean
  newStatus: AtcPluginHealthStatus
}

function makeRecord(): AtcPluginHealthRecord {
  return {
    status: 'healthy',
    failureCount: 0,
    restartCount: 0,
    lastHeartbeat: null,
    lastError: null,
  }
}

export class AtcPluginHealthMonitor {
  private readonly _records = new Map<string, AtcPluginHealthRecord>()
  private readonly _maxFailures: number
  private readonly _degradeThreshold: number

  constructor(options: AtcPluginHealthMonitorOptions = {}) {
    this._maxFailures = options.maxFailures ?? 5
    this._degradeThreshold = options.degradeThreshold ?? Math.ceil((options.maxFailures ?? 5) / 2)
  }

  init(pluginId: string): void {
    this._records.set(pluginId, makeRecord())
  }

  recordFailure(pluginId: string, error?: string): FailureResult {
    const record = this._records.get(pluginId) ?? makeRecord()
    record.failureCount++
    if (error !== undefined) record.lastError = error

    if (record.failureCount >= this._maxFailures) {
      record.status = 'failed'
      this._records.set(pluginId, record)
      return { shouldDisable: true, newStatus: 'failed' }
    }

    if (record.failureCount >= this._degradeThreshold) {
      record.status = 'degraded'
    }

    this._records.set(pluginId, record)
    return { shouldDisable: false, newStatus: record.status }
  }

  recordSuccess(pluginId: string): void {
    const record = this._records.get(pluginId) ?? makeRecord()
    record.lastHeartbeat = new Date().toISOString()
    this._records.set(pluginId, record)
  }

  heartbeat(pluginId: string): void {
    const record = this._records.get(pluginId) ?? makeRecord()
    record.lastHeartbeat = new Date().toISOString()
    this._records.set(pluginId, record)
  }

  incrementRestartCount(pluginId: string): void {
    const record = this._records.get(pluginId) ?? makeRecord()
    record.restartCount++
    this._records.set(pluginId, record)
  }

  getHealth(pluginId: string): AtcPluginHealthRecord {
    const record = this._records.get(pluginId)
    if (!record) return makeRecord()
    return { ...record }
  }

  getAll(): Map<string, AtcPluginHealthRecord> {
    const result = new Map<string, AtcPluginHealthRecord>()
    for (const [id, record] of this._records) {
      result.set(id, { ...record })
    }
    return result
  }

  resetFailures(pluginId: string): void {
    const record = this._records.get(pluginId) ?? makeRecord()
    record.failureCount = 0
    record.status = 'healthy'
    this._records.set(pluginId, record)
  }

  reset(pluginId: string): void {
    this._records.set(pluginId, makeRecord())
  }

  remove(pluginId: string): void {
    this._records.delete(pluginId)
  }
}
