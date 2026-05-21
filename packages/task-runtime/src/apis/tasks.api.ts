import type { AtcPluginTasksApi, AtcPluginTaskOptions, AtcPluginApiResult, AtcPluginCapability } from '@atc/shared-types'
import type { AtcPluginRegistry } from '@atc/plugin-registry'
import type { AtcTaskRuntime } from '../runtime.js'

export class PluginTasksApi implements AtcPluginTasksApi {
  constructor(
    private readonly _pluginId: string,
    private readonly _capabilities: ReadonlyArray<AtcPluginCapability>,
    private readonly _runtime: AtcTaskRuntime,
    private readonly _registry: AtcPluginRegistry,
  ) {}

  async enqueue(
    type: string,
    payload: unknown,
    opts?: AtcPluginTaskOptions,
  ): Promise<AtcPluginApiResult<string>> {
    if (!this._capabilities.includes('tasks.enqueue')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return { ok: false, error: 'Permission denied: tasks.enqueue required' }
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
      return { ok: true, data: taskId }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      return { ok: false, error }
    }
  }

  async schedule(
    type: string,
    payload: unknown,
    delayMs: number,
    opts?: AtcPluginTaskOptions,
  ): Promise<AtcPluginApiResult<string>> {
    if (!this._capabilities.includes('tasks.schedule')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return { ok: false, error: 'Permission denied: tasks.schedule required' }
    }

    const clampedDelay = Math.max(0, Math.min(delayMs, 86_400_000))

    try {
      const taskId = await this._runtime.schedule({
        type,
        payload,
        delayMs: clampedDelay,
        pluginId: this._pluginId,
        queueName: `atc:tasks:plugin:${this._pluginId}`,
        ...(opts?.maxRetries !== undefined && { maxRetries: opts.maxRetries }),
        ...(opts?.timeoutMs !== undefined && { timeoutMs: opts.timeoutMs }),
      })
      this._registry.incrementApiCall(this._pluginId)
      return { ok: true, data: taskId }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      return { ok: false, error }
    }
  }
}
