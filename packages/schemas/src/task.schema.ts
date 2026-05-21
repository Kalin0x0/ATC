import { z } from 'zod'

const isoDatetimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Must be an ISO 8601 datetime string')

const taskIdSchema = z
  .string()
  .uuid('Must be a valid UUID task ID')

export const taskStateSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'retrying',
  'cancelled',
  'expired',
])

export const retryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).max(10),
  initialDelayMs: z.number().int().min(100).max(60_000),
  backoffMultiplier: z.number().min(1).max(10),
  maxDelayMs: z.number().int().min(1_000).max(3_600_000),
})

export const taskSchema = z.object({
  id: taskIdSchema,
  pluginId: z.string().nullable(),
  type: z.string().min(1).max(128).regex(/^[a-z0-9_.-]+$/, 'Type must be lowercase alphanumeric, dot, underscore, or dash'),
  payload: z.unknown(),
  state: taskStateSchema,
  retryPolicy: retryPolicySchema,
  retryCount: z.number().int().nonnegative(),
  createdAt: isoDatetimeSchema,
  scheduledAt: isoDatetimeSchema.nullable(),
  startedAt: isoDatetimeSchema.nullable(),
  completedAt: isoDatetimeSchema.nullable(),
  failedAt: isoDatetimeSchema.nullable(),
  nextRetryAt: isoDatetimeSchema.nullable(),
  error: z.string().max(2048).nullable(),
  queueName: z.string().min(1).max(256),
  timeoutMs: z.number().int().min(100).max(300_000),
})

export const taskPayloadRequestSchema = z.object({
  type: z.string().min(1).max(128).regex(/^[a-z0-9_.-]+$/),
  payload: z.unknown().optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  timeoutMs: z.number().int().min(100).max(300_000).optional(),
})

export const scheduleTaskRequestSchema = taskPayloadRequestSchema.extend({
  delayMs: z.number().int().min(0).max(86_400_000),
})

export const workerMetricsSchema = z.object({
  workerId: z.string().min(1),
  pluginId: z.string().nullable(),
  queueName: z.string().min(1),
  processedJobs: z.number().nonnegative().int(),
  failures: z.number().nonnegative().int(),
  retries: z.number().nonnegative().int(),
  totalExecutionMs: z.number().nonnegative(),
  isRunning: z.boolean(),
  startedAt: isoDatetimeSchema,
})

export const queueMetricsSchema = z.object({
  name: z.string().min(1),
  depth: z.number().nonnegative().int(),
  deadLetterSize: z.number().nonnegative().int(),
  processingCount: z.number().nonnegative().int(),
})

export const taskRuntimeMetricsSchema = z.object({
  queuedTotal: z.number().nonnegative().int(),
  completedTotal: z.number().nonnegative().int(),
  failedTotal: z.number().nonnegative().int(),
  retriedTotal: z.number().nonnegative().int(),
  activeWorkers: z.number().nonnegative().int(),
  avgRuntimeMs: z.number().nonnegative(),
  queues: z.array(queueMetricsSchema),
})

// Event store
export const storedEventSchema = z.object({
  id: z.string().min(1),
  streamId: z.string().min(1),
  eventName: z.string().min(1),
  payload: z.unknown(),
  source: z.string().min(1),
  storedAt: isoDatetimeSchema,
})

export const eventRetentionPolicySchema = z.object({
  maxEvents: z.number().int().positive().optional(),
  maxAgeMs: z.number().int().positive().optional(),
})

export type TaskStateOutput = z.output<typeof taskStateSchema>
export type RetryPolicyOutput = z.output<typeof retryPolicySchema>
export type TaskOutput = z.output<typeof taskSchema>
export type TaskPayloadRequestInput = z.input<typeof taskPayloadRequestSchema>
export type WorkerMetricsOutput = z.output<typeof workerMetricsSchema>
export type QueueMetricsOutput = z.output<typeof queueMetricsSchema>
export type TaskRuntimeMetricsOutput = z.output<typeof taskRuntimeMetricsSchema>
export type StoredEventOutput = z.output<typeof storedEventSchema>
