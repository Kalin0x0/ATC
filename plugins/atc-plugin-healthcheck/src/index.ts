import type { AtcPluginHooks, AtcPluginServiceContainer } from '@atc/shared-types'

const PLUGIN_ID = 'atc-plugin-healthcheck'
const HEARTBEAT_INTERVAL_MS = 30_000

let _container: AtcPluginServiceContainer | undefined

export const hooks: AtcPluginHooks = {
  onSetup(container: AtcPluginServiceContainer): void {
    _container = container

    // Schedule periodic heartbeat — auto-cancelled on stop via cleanup manager
    container.cleanup.scheduleInterval(() => {
      container.telemetryApi.record('heartbeat', 1, 'counter')
      container.logger.debug('Healthcheck heartbeat', { pluginId: PLUGIN_ID })
    }, HEARTBEAT_INTERVAL_MS)
  },

  async onLoad(): Promise<void> {
    _container?.logger.info('Healthcheck plugin loading', { pluginId: PLUGIN_ID })
  },

  async onEnable(): Promise<void> {
    if (!_container) return

    _container.logger.info('Healthcheck plugin active', { pluginId: PLUGIN_ID })
    _container.telemetryApi.record('enabled', 1, 'counter')

    // Subscribe to plugin lifecycle events (requires events.subscribe capability)
    _container.eventsApi.on('atc:plugin:started', (payload) => {
      _container?.logger.info('Plugin started', { payload })
    })

    _container.eventsApi.on('atc:plugin:failed', (payload) => {
      _container?.logger.warn('Plugin failed', { payload })
      _container?.telemetryApi.record('downstream_failures', 1, 'counter')
    })
  },

  async onDisable(): Promise<void> {
    _container?.logger.info('Healthcheck plugin disabling', { pluginId: PLUGIN_ID })
    _container = undefined
  },

  onError(err: Error): void {
    _container?.logger.error('Healthcheck plugin error', {
      pluginId: PLUGIN_ID,
      error: err.message,
    })
    _container?.telemetryApi.record('errors', 1, 'counter')
  },
}

export const manifest = {
  id: PLUGIN_ID,
  version: '1.0.0',
  capabilities: ['events.subscribe', 'events.publish', 'telemetry.write'] as const,
  dependencies: [],
}
