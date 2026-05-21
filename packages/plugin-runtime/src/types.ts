import type { AtcPluginCapability } from '@atc/shared-types'

export type { AtcPluginCapability }

export class AtcPermissionDeniedError extends Error {
  constructor(
    public readonly pluginId: string,
    public readonly capability: AtcPluginCapability | string,
  ) {
    super(`Plugin '${pluginId}' does not have capability '${capability}'`)
    this.name = 'AtcPermissionDeniedError'
  }
}
