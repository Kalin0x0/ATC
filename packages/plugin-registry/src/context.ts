import type { AtcPluginCapability, AtcPluginLogger } from '@atc/shared-types'
import { AtcPluginPermissionGuard, AtcPermissionDeniedError } from '@atc/plugin-runtime'

export interface AtcPluginContextOptions {
  pluginId: string
  capabilities: ReadonlyArray<AtcPluginCapability>
  logger: AtcPluginLogger
}

export interface AtcPluginRuntimeContext {
  readonly pluginId: string
  readonly capabilities: ReadonlyArray<AtcPluginCapability>
  readonly logger: AtcPluginLogger
  readonly hasPermission: (cap: AtcPluginCapability) => boolean
  readonly assertPermission: (cap: AtcPluginCapability) => void
}

export function createPluginContext(options: AtcPluginContextOptions): Readonly<AtcPluginRuntimeContext> {
  const guard = new AtcPluginPermissionGuard(options.capabilities as string[])

  const context: AtcPluginRuntimeContext = {
    pluginId: options.pluginId,
    capabilities: Object.freeze([...options.capabilities]),
    logger: Object.freeze({
      info: (msg: string, data?: Record<string, unknown>) => options.logger.info(msg, data),
      warn: (msg: string, data?: Record<string, unknown>) => options.logger.warn(msg, data),
      error: (msg: string, data?: Record<string, unknown>) => options.logger.error(msg, data),
      debug: (msg: string, data?: Record<string, unknown>) => options.logger.debug(msg, data),
    }),
    hasPermission: (cap: AtcPluginCapability) => guard.hasPermission(cap),
    assertPermission: (cap: AtcPluginCapability) => {
      if (!guard.hasPermission(cap)) {
        throw new AtcPermissionDeniedError(options.pluginId, cap)
      }
    },
  }

  return Object.freeze(context)
}

export { AtcPermissionDeniedError }
