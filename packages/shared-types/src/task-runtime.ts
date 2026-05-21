import type { AtcPluginApiResult } from './plugin-runtime-api.js'

export type AtcTaskState =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'cancelled'
  | 'expired'

export interface AtcRetryPolicy {
  maxRetries: number
  initialDelayMs: number
  backoffMultiplier: number
  maxDelayMs: number
}

export interface AtcTask {
  id: string
  pluginId: string | null
  type: string
  payload: unknown
  state: AtcTaskState
  retryPolicy: AtcRetryPolicy
  retryCount: number
  createdAt: string
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  failedAt: string | null
  nextRetryAt: string | null
  error: string | null
  queueName: string
  timeoutMs: number
}

export interface AtcWorkerMetrics {
  workerId: string
  pluginId: string | null
  queueName: string
  processedJobs: number
  failures: number
  retries: number
  totalExecutionMs: number
  isRunning: boolean
  startedAt: string
}

export interface AtcQueueMetrics {
  name: string
  depth: number
  deadLetterSize: number
  processingCount: number
}

export interface AtcTaskRuntimeMetrics {
  queuedTotal: number
  completedTotal: number
  failedTotal: number
  retriedTotal: number
  activeWorkers: number
  avgRuntimeMs: number
  queues: AtcQueueMetrics[]
}

export interface AtcPluginTaskOptions {
  maxRetries?: number
  timeoutMs?: number
}

export interface AtcPluginTasksApi {
  enqueue(
    type: string,
    payload: unknown,
    opts?: AtcPluginTaskOptions,
  ): Promise<AtcPluginApiResult<string>>
  schedule(
    type: string,
    payload: unknown,
    delayMs: number,
    opts?: AtcPluginTaskOptions,
  ): Promise<AtcPluginApiResult<string>>
}

// Event store types
export interface AtcStoredEvent {
  id: string
  streamId: string
  eventName: string
  payload: unknown
  source: string
  storedAt: string
  // Distribution prep — identifies which node appended this event
  sourceInstanceId?: string
}

export interface AtcEventRetentionPolicy {
  maxEvents?: number
  maxAgeMs?: number
}
