export class PluginDuplicateError extends Error {
  constructor(public readonly pluginId: string) {
    super(`Plugin '${pluginId}' is already registered`)
    this.name = 'PluginDuplicateError'
  }
}

export class PluginNotFoundError extends Error {
  constructor(public readonly pluginId: string) {
    super(`Plugin '${pluginId}' is not registered`)
    this.name = 'PluginNotFoundError'
  }
}

export class PluginDependencyCycleError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Plugin dependency cycle detected: ${cycle.join(' → ')}`)
    this.name = 'PluginDependencyCycleError'
  }
}

export class PluginMissingDependencyError extends Error {
  constructor(
    public readonly pluginId: string,
    public readonly dependencyId: string,
  ) {
    super(`Plugin '${pluginId}' requires '${dependencyId}' which is not registered`)
    this.name = 'PluginMissingDependencyError'
  }
}

export class PluginVersionMismatchError extends Error {
  constructor(
    public readonly pluginId: string,
    public readonly dependencyId: string,
    public readonly required: string,
    public readonly actual: string,
  ) {
    super(
      `Plugin '${pluginId}' requires '${dependencyId}@${required}' but found '${actual}'`,
    )
    this.name = 'PluginVersionMismatchError'
  }
}

export class PluginLifecycleTimeoutError extends Error {
  constructor(
    public readonly pluginId: string,
    public readonly hook: string,
    public readonly timeoutMs: number,
  ) {
    super(`Plugin '${pluginId}' hook '${hook}' timed out after ${timeoutMs}ms`)
    this.name = 'PluginLifecycleTimeoutError'
  }
}

export class PluginInvalidStatusError extends Error {
  constructor(pluginId: string, current: string, required: string) {
    super(`Plugin '${pluginId}' must be '${required}' but is '${current}'`)
    this.name = 'PluginInvalidStatusError'
  }
}

export class PluginConcurrentOperationError extends Error {
  constructor(public readonly pluginId: string) {
    super(`Plugin '${pluginId}' already has a lifecycle operation in progress`)
    this.name = 'PluginConcurrentOperationError'
  }
}
