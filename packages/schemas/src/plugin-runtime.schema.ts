import { z } from 'zod'
import { atcPluginCapabilitySchema } from './plugin.schema.js'

export { atcPluginCapabilitySchema }

export const pluginRuntimeMetricsSchema = z.object({
  pluginId: z.string(),
  eventsPublished: z.number().int().min(0),
  eventsSubscribed: z.number().int().min(0),
  permissionDeniedCount: z.number().int().min(0),
  registeredAt: z.string().datetime(),
})

export const pluginMetricsListSchema = z.object({
  plugins: z.array(pluginRuntimeMetricsSchema),
})

export type PluginRuntimeMetricsOutput = z.output<typeof pluginRuntimeMetricsSchema>
