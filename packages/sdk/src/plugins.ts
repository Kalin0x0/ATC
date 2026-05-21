import type { AtcPluginManifest, AtcPluginRegistration, AtcPluginStatus } from '@atc/shared-types'
import { atcPluginManifestSchema } from '@atc/schemas'
import { AtcValidationError, AtcNotFoundError } from './errors.js'

export class AtcPluginRegistry {
  private readonly _plugins = new Map<string, AtcPluginRegistration>()

  register(manifest: AtcPluginManifest): AtcPluginRegistration {
    const result = atcPluginManifestSchema.safeParse(manifest)
    if (!result.success) {
      throw new AtcValidationError(
        result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      )
    }

    if (this._plugins.has(manifest.id)) {
      const existing = this._plugins.get(manifest.id)!
      if (existing.status !== 'error' && existing.status !== 'disabled') {
        throw new Error(`Plugin '${manifest.id}' is already registered`)
      }
    }

    const registration: AtcPluginRegistration = {
      manifest: result.data as AtcPluginManifest,
      status: 'registered',
      registeredAt: Date.now(),
    }

    this._plugins.set(manifest.id, registration)
    return registration
  }

  get(id: string): AtcPluginRegistration {
    const plugin = this._plugins.get(id)
    if (!plugin) throw new AtcNotFoundError('Plugin', id)
    return plugin
  }

  setStatus(id: string, status: AtcPluginStatus, errorMessage?: string): void {
    const plugin = this._plugins.get(id)
    if (!plugin) throw new AtcNotFoundError('Plugin', id)
    plugin.status = status
    if (errorMessage) plugin.errorMessage = errorMessage
  }

  isLoaded(id: string): boolean {
    return this._plugins.get(id)?.status === 'ready'
  }

  getAll(): AtcPluginRegistration[] {
    return Array.from(this._plugins.values())
  }

  resolveLoadOrder(ids: string[]): string[] {
    const visited = new Set<string>()
    const order: string[] = []

    const visit = (id: string): void => {
      if (visited.has(id)) return
      visited.add(id)
      const plugin = this._plugins.get(id)
      if (plugin) {
        for (const depId of Object.keys(plugin.manifest.dependencies)) {
          visit(depId)
        }
      }
      order.push(id)
    }

    for (const id of ids) visit(id)
    return order
  }
}
