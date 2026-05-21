import type { AtcTask, AtcWorkerMetrics } from '@atc/shared-types'
import { TaskTimeoutError } from './errors.js'
import { classifyFailure, computeRetryDelayMs } from './retry.js'

export type TaskHandler = (task: AtcTask) => Promise<void>

export interface WorkerOptions {
  queueName?: string
  timeoutMs?: number
  concurrency?: number
}

function withTimeout<T>(promise: Promise<T>, ms: number, taskId: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new TaskTimeoutError(taskId, ms)),
      ms,
    )
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e: unknown) => { clearTimeout(timer); reject(e) },
    )
  })
}

export class AtcWorker {
  readonly workerId: string
  readonly queueName: string
  private readonly _timeoutMs: number
  private readonly _pluginId: string | null

  private _processedJobs = 0
  private _failures = 0
  private _retries = 0
  private _totalExecutionMs = 0
  private _isRunning = false
  private readonly _startedAt: string

  constructor(
    workerId: string,
    private readonly _handler: TaskHandler,
    opts: WorkerOptions & { pluginId?: string | null } = {},
  ) {
    this.workerId = workerId
    this.queueName = opts.queueName ?? 'atc:tasks:default'
    this._timeoutMs = opts.timeoutMs ?? 30_000
    this._pluginId = opts.pluginId ?? null
    this._startedAt = new Date().toISOString()
  }

  get isRunning(): boolean { return this._isRunning }

  async execute(task: AtcTask): Promise<'completed' | 'retry' | 'dead-letter'> {
    this._isRunning = true
    const started = Date.now()

    try {
      const effectiveTimeout = task.timeoutMs > 0 ? Math.min(task.timeoutMs, this._timeoutMs) : this._timeoutMs
      await withTimeout(this._handler(task), effectiveTimeout, task.id)
      this._processedJobs++
      this._totalExecutionMs += Date.now() - started
      return 'completed'
    } catch (err) {
      this._failures++
      this._totalExecutionMs += Date.now() - started

      const classification = classifyFailure(err)
      const canRetry = classification === 'retryable' && task.retryCount < task.retryPolicy.maxRetries

      if (canRetry) {
        this._retries++
        return 'retry'
      }
      return 'dead-letter'
    } finally {
      this._isRunning = false
    }
  }

  getMetrics(): AtcWorkerMetrics {
    return {
      workerId: this.workerId,
      pluginId: this._pluginId,
      queueName: this.queueName,
      processedJobs: this._processedJobs,
      failures: this._failures,
      retries: this._retries,
      totalExecutionMs: this._totalExecutionMs,
      isRunning: this._isRunning,
      startedAt: this._startedAt,
    }
  }
}

export class AtcWorkerRegistry {
  private readonly _workers = new Map<string, AtcWorker>()

  register(worker: AtcWorker): void {
    this._workers.set(worker.workerId, worker)
  }

  get(workerId: string): AtcWorker | undefined {
    return this._workers.get(workerId)
  }

  getForQueue(queueName: string): AtcWorker[] {
    return Array.from(this._workers.values()).filter((w) => w.queueName === queueName)
  }

  getAll(): AtcWorker[] {
    return Array.from(this._workers.values())
  }

  getAllQueueNames(): string[] {
    return [...new Set(Array.from(this._workers.values()).map((w) => w.queueName))]
  }

  unregister(workerId: string): void {
    this._workers.delete(workerId)
  }
}

export { computeRetryDelayMs }
