import { z } from 'zod'

export const telemetryMetricKindSchema = z.enum(['counter', 'gauge', 'histogram'])

export const telemetryMetricSchema = z.object({
  name: z.string().min(1).max(128),
  kind: telemetryMetricKindSchema,
  value: z.number(),
  labels: z.record(z.string()).optional(),
  updatedAt: z.string().datetime(),
})

export const telemetrySnapshotSchema = z.object({
  metrics: z.array(telemetryMetricSchema),
  capturedAt: z.string().datetime(),
})

export const eventBusMetricsSchema = z.object({
  emittedTotal: z.number().int().min(0),
  handledTotal: z.number().int().min(0),
  failedTotal: z.number().int().min(0),
  avgDurationMs: z.number().min(0),
  activeSubscribers: z.number().int().min(0),
  metricsEnabled: z.boolean(),
})

export const runtimeMetricsSchema = z.object({
  uptimeSeconds: z.number().int().min(0),
  memoryUsage: z.object({
    heapUsedBytes: z.number().int().min(0),
    heapTotalBytes: z.number().int().min(0),
    rssBytes: z.number().int().min(0),
    externalBytes: z.number().int().min(0),
  }),
  activeRateLimits: z.number().int().min(0),
  redisConnected: z.boolean(),
})

export type TelemetryMetricOutput = z.output<typeof telemetryMetricSchema>
export type EventBusMetricsOutput = z.output<typeof eventBusMetricsSchema>
export type RuntimeMetricsOutput = z.output<typeof runtimeMetricsSchema>
