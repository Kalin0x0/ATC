import type { AtcPermission } from './permission.js'

export type AtcPluginStatus = 'registered' | 'loading' | 'ready' | 'error' | 'disabled'

export interface AtcPluginManifest {
  $schema?: string
  id: string
  name: string
  description?: string
  version: string
  apiVersion: string
  author: string
  license?: string
  repository?: string
  dependencies: Record<string, string>
  optionalDependencies?: Record<string, string>
  permissions: AtcPermission[]
  entryPoints: AtcPluginEntryPoints
  events?: AtcPluginEvents
  config?: Record<string, unknown>
  migrations?: string[]
}

export interface AtcPluginEntryPoints {
  server?: string
  client?: string
  shared?: string
  api?: string
  ui?: string
}

export interface AtcPluginEvents {
  publishes?: string[]
  subscribes?: string[]
}

export interface AtcPluginRegistration {
  manifest: AtcPluginManifest
  status: AtcPluginStatus
  registeredAt: number
  errorMessage?: string
}

export interface AtcPluginDependencyGraph {
  id: string
  dependencies: string[]
  optionalDependencies: string[]
  loadOrder: number
}
