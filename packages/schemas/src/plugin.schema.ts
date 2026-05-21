import { z } from 'zod'
import { semverSchema, semverRangeSchema, atcEventNameSchema } from './helpers.js'

const atcPermissionSchema = z.string().regex(
  /^(player|inventory|economy|territory|housing|vehicle|social|dispatch|admin)\.(read|write|admin|spectate|ban|kick|warn|freeze|teleport|noclip|god|audit|evidence)$/,
  'Must be a valid ATC permission (domain.action)'
)

export const atcPluginCapabilitySchema = z.enum([
  'inventory.read',
  'inventory.write',
  'vitals.read',
  'vitals.write',
  'status.read',
  'status.write',
  'wallet.read',
  'wallet.write',
  'events.publish',
  'events.subscribe',
  'telemetry.write',
  'admin.read',
  'admin.write',
  'tasks.enqueue',
  'tasks.schedule',
])

export const atcPluginEntryPointsSchema = z.object({
  server: z.string().optional(),
  client: z.string().optional(),
  shared: z.string().optional(),
  api: z.string().optional(),
  ui: z.string().optional(),
})

export const atcPluginEventsSchema = z.object({
  publishes: z.array(atcEventNameSchema).optional(),
  subscribes: z.array(atcEventNameSchema).optional(),
})

export const atcPluginManifestSchema = z.object({
  $schema: z.string().url().optional(),
  id: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z][a-z0-9-]*$/, 'Plugin ID must be lowercase kebab-case'),
  name: z.string().min(3).max(128),
  description: z.string().max(512).optional(),
  version: semverSchema,
  apiVersion: z.string().regex(/^\d+$/, 'API version must be a numeric string'),
  author: z.string().min(1).max(128),
  license: z.string().optional(),
  repository: z.string().url().optional(),
  dependencies: z.record(semverRangeSchema),
  optionalDependencies: z.record(semverRangeSchema).optional(),
  permissions: z.array(atcPermissionSchema),
  capabilities: z.array(atcPluginCapabilitySchema).optional(),
  entryPoints: atcPluginEntryPointsSchema,
  events: atcPluginEventsSchema.optional(),
  config: z.record(z.unknown()).optional(),
  migrations: z.array(z.string()).optional(),
})

export type AtcPluginManifestInput = z.input<typeof atcPluginManifestSchema>
