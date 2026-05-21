import { z } from 'zod'
import { semverSchema, semverRangeSchema } from './helpers.js'
import { atcPluginCapabilitySchema } from './plugin.schema.js'

export const pluginRuntimeStatusSchema = z.enum([
  'registered',
  'loading',
  'active',
  'disabled',
  'failed',
  'unloading',
])

export const pluginHealthStatusSchema = z.enum(['healthy', 'degraded', 'failed'])

export const pluginDependencySchema = z.object({
  id: z.string().min(1).max(128).regex(/^[a-z0-9_-]+$/, 'Must be lowercase alphanumeric/dash/underscore'),
  version: semverRangeSchema,
})

export const registryManifestSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[a-z0-9_-]+$/, 'Must be lowercase alphanumeric/dash/underscore'),
  version: semverSchema,
  capabilities: z.array(atcPluginCapabilitySchema).optional(),
  dependencies: z.array(pluginDependencySchema).optional(),
}).refine(
  (data) => {
    if (!data.dependencies || data.dependencies.length === 0) return true
    const ids = data.dependencies.map((d) => d.id)
    return ids.length === new Set(ids).size
  },
  { message: 'Duplicate dependency IDs are not allowed in plugin manifest' },
)

export const pluginLifecycleMetricsSchema = z.object({
  loadTimeMs: z.number().nonnegative(),
  enableTimeMs: z.number().nonnegative(),
  disableTimeMs: z.number().nonnegative(),
  unloadTimeMs: z.number().nonnegative(),
  reloadCount: z.number().nonnegative().int(),
})

export const pluginHealthRecordSchema = z.object({
  status: pluginHealthStatusSchema,
  failureCount: z.number().nonnegative().int(),
  restartCount: z.number().nonnegative().int(),
  lastHeartbeat: z.string().nullable(),
  lastError: z.string().nullable(),
})

export const pluginRecordSchema = z.object({
  id: z.string(),
  version: z.string(),
  capabilities: z.array(atcPluginCapabilitySchema),
  dependencies: z.array(pluginDependencySchema),
  status: pluginRuntimeStatusSchema,
  loadedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  health: pluginHealthRecordSchema,
  lifecycleMetrics: pluginLifecycleMetricsSchema,
})

export const pluginMetricsSnapshotSchema = z.object({
  id: z.string(),
  status: pluginRuntimeStatusSchema,
  healthStatus: pluginHealthStatusSchema,
  restartCount: z.number().nonnegative().int(),
  failures: z.number().nonnegative().int(),
  eventsHandled: z.number().nonnegative().int(),
  avgExecutionMs: z.number().nonnegative(),
  lastError: z.string().nullable(),
})

export const pluginExtendedMetricsSchema = pluginMetricsSnapshotSchema.extend({
  apiCalls: z.number().nonnegative().int(),
  deniedCalls: z.number().nonnegative().int(),
  activeSubscriptions: z.number().nonnegative().int(),
  activeTimers: z.number().nonnegative().int(),
  uptimeMs: z.number().nonnegative(),
})

export const pluginPersistedStateSchema = z.object({
  pluginId: z.string(),
  enabled: z.boolean(),
  crashCount: z.number().nonnegative().int(),
  lastLoadedAt: z.string().nullable(),
  settings: z.record(z.unknown()),
})

export type RegistryManifestInput = z.input<typeof registryManifestSchema>
export type RegistryManifestOutput = z.output<typeof registryManifestSchema>
export type PluginRecordOutput = z.output<typeof pluginRecordSchema>
export type PluginMetricsSnapshotOutput = z.output<typeof pluginMetricsSnapshotSchema>
export type PluginExtendedMetricsOutput = z.output<typeof pluginExtendedMetricsSchema>
