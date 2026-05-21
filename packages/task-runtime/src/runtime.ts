import type { AtcTask, AtcRetryPolicy, AtcTaskRuntimeMetrics, AtcWorkerMetrics } from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import type { AtcEventBus } from '@atc/events'
import { randomUUID } from 'node:crypto'
import { AtcTaskQueue, type TaskQueueStorage } from './queue.js'
import { AtcWorker, AtcWorkerRegistry, type TaskHandler, type WorkerOptions } from './worker.js'
import { AtcTaskScheduler, type SchedulerOptions } from './scheduler.js'
import { DEFAULT_RETRY_POLICY, computeRetryDelayMs, classifyFailure } from './retry.js'
import { TaskTypeInvalidError } from './errors.js'
import type { AtcWorkerLeaseManager } from './lease.js'
import type { AtcSchedulerLeaderElection } from './leader.js'

const TASK_TYPE_REGEX = /^[a-z0-9_.-]+$/
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_QUEUE = 'atc:tasks:default'

export interface AtcTaskRuntimeOptions {
  storage: TaskQueueStorage
  telemetry: AtcTelemetryService
  eventBus: AtcEventBus
  scheduler?: SchedulerOptions
  defaultRetryPolicy?: Partial<AtcRetryPolicy>
  maxQueueDepth?: number
  /** Optional worker lease manager — prevents duplicate task execution across instances */
  leaseManager?: AtcWorkerLeaseManager
  /** Optional leader election — controls whether this instance runs the scheduler */
  leaderElection?: AtcSchedulerLeaderElection
  /** Stable identifier for this runtime instance (used as lease holder ID) */
  instanceId?: string
}

export interface EnqueueOptions {
  type: string
  payload?: unknown
  pluginId?: string | null
  queueName?: string
  maxRetries?: number
  timeoutMs?: number
  retryPolicy?: Partial<AtcRetryPolicy>
}

export interface ScheduleOptions extends EnqueueOptions {
  delayMs: number
}

export class AtcTaskRuntime {
  private readonly _queue: AtcTaskQueue
  private readonly _workerRegistry: AtcWorkerRegistry
  private readonly _scheduler: AtcTaskScheduler
  private readonly _telemetry: AtcTelemetryService
  private readonly _eventBus: AtcEventBus
  private readonly _defaultRetryPolicy: AtcRetryPolicy
  private readonly _leaseManager: AtcWorkerLeaseManager | undefined
  private readonly _instanceId: string

  // In-process task state: tracks state of tasks currently in flight
  private readonly _activeTasks = new Map<string, AtcTask>()
  private readonly _cancelledIds = new Set<string>()

  // Aggregate counters (reset on stop)
  private _queuedTotal = 0
  private _completedTotal = 0
  private _failedTotal = 0
  private _retriedTotal = 0
  private _totalRuntimeMs = 0

  constructor(opts: AtcTaskRuntimeOptions) {
    this._telemetry = opts.telemetry
    this._eventBus = opts.eventBus
    this._defaultRetryPolicy = { ...DEFAULT_RETRY_POLICY, ...opts.defaultRetryPolicy }
    this._leaseManager = opts.leaseManager
    this._instanceId = opts.instanceId ?? `runtime-${randomUUID()}`
    this._queue = new AtcTaskQueue(opts.storage, opts.maxQueueDepth)
    this._workerRegistry = new AtcWorkerRegistry()
    this._scheduler = new AtcTaskScheduler(
      this._queue,
      this._workerRegistry,
      (task) => this._executeTask(task),
      { ...opts.scheduler, ...(opts.leaderElection !== undefined ? { leaderElection: opts.leaderElection } : {}) },
    )
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  registerWorker(
    type: string,
    handler: TaskHandler,
    opts: WorkerOptions & { pluginId?: string | null } = {},
  ): string {
    const workerId = `worker-${type}-${randomUUID()}`
    const worker = new AtcWorker(workerId, handler, opts)
    this._workerRegistry.register(worker)
    this._telemetry.increment('atc.tasks.active_workers')
    return workerId
  }

  async enqueue(opts: EnqueueOptions): Promise<string> {
    this._validateType(opts.type)
    const task = this._buildTask(opts)
    await this._queue.enqueue(task)
    this._activeTasks.set(task.id, task)
    this._queuedTotal++
    this._telemetry.increment('atc.tasks.queued_total')
    this._emitEvent('atc:task:queued', { taskId: task.id, type: task.type, pluginId: task.pluginId })
    return task.id
  }

  async schedule(opts: ScheduleOptions): Promise<string> {
    this._validateType(opts.type)
    const scheduledAt = new Date(Date.now() + opts.delayMs).toISOString()
    const task = this._buildTask(opts, scheduledAt)
    await this._queue.scheduleDelayed(task)
    this._activeTasks.set(task.id, task)
    this._queuedTotal++
    this._telemetry.increment('atc.tasks.queued_total')
    this._emitEvent('atc:task:queued', { taskId: task.id, type: task.type, pluginId: task.pluginId, scheduledAt })
    return task.id
  }

  cancel(taskId: string): boolean {
    const task = this._activeTasks.get(taskId)
    if (!task) return false
    if (task.state !== 'queued' && task.state !== 'retrying') return false
    this._cancelledIds.add(taskId)
    this._updateTaskState(taskId, 'cancelled')
    this._emitEvent('atc:task:cancelled', { taskId, type: task.type, pluginId: task.pluginId })
    return true
  }

  getTask(taskId: string): AtcTask | undefined {
    return this._activeTasks.get(taskId)
  }

  getMetrics(): AtcTaskRuntimeMetrics {
    const workers = this._workerRegistry.getAll()
    const activeWorkers = workers.filter((w) => w.isRunning).length

    const totalRuntime = this._totalRuntimeMs
    const completedTotal = this._completedTotal
    const avgRuntimeMs = completedTotal > 0 ? totalRuntime / completedTotal : 0

    return {
      queuedTotal: this._queuedTotal,
      completedTotal: this._completedTotal,
      failedTotal: this._failedTotal,
      retriedTotal: this._retriedTotal,
      activeWorkers,
      avgRuntimeMs,
      queues: [],
    }
  }

  async getQueueMetrics(): Promise<AtcTaskRuntimeMetrics> {
    const base = this.getMetrics()
    const queueNames = [
      ...new Set([
        ...this._queue.getAllQueueNames(),
        ...this._workerRegistry.getAllQueueNames(),
      ]),
    ]

    const queues = await Promise.all(
      queueNames.map(async (name) => ({
        name,
        depth: await this._queue.getDepth(name).catch(() => 0),
        deadLetterSize: await this._queue.getDeadLetterSize().catch(() => 0),
        processingCount: this._workerRegistry
          .getForQueue(name)
          .filter((w) => w.isRunning).length,
      })),
    )

    return { ...base, queues }
  }

  getWorkerMetrics(): AtcWorkerMetrics[] {
    return this._workerRegistry.getAll().map((w) => w.getMetrics())
  }

  async listDeadLetter(limit = 20, offset = 0): Promise<{ items: AtcTask[]; total: number; offset: number; limit: number }> {
    return this._queue.listDeadLetter(limit, offset)
  }

  async requeueDeadLetterTask(taskId: string): Promise<boolean> {
    const requeued = await this._queue.requeueFromDeadLetter(taskId)
    if (requeued) {
      this._queuedTotal++
      this._telemetry.increment('ops.dlq_requeues_total')
      this._emitEvent('atc:task:requeued', { taskId, source: 'dead_letter' })
    }
    return requeued
  }

  start(): void {
    this._scheduler.start()
  }

  stop(): void {
    this._scheduler.stop()
  }

  get isRunning(): boolean {
    return this._scheduler.isRunning
  }

  // Exposed for testing — runs one scheduler tick manually
  async tick(): Promise<void> {
    return this._scheduler.tick()
  }

  // ── Internal execution ────────────────────────────────────────────────────────

  private async _executeTask(task: AtcTask): Promise<void> {
    // Check for cancellation before any state changes
    if (this._cancelledIds.has(task.id)) {
      this._activeTasks.delete(task.id)
      return
    }

    // Find an idle worker BEFORE marking the task as running.
    // This ensures cancel() can still work if no worker is available and
    // prevents emitting a false 'started' event for tasks that get re-queued.
    const workers = this._workerRegistry.getForQueue(task.queueName)
    const worker = workers.find((w) => !w.isRunning)

    if (!worker) {
      // No idle worker — put task back in queue, keeping state as 'queued'
      this._updateTaskState(task.id, 'queued')
      await this._queue.enqueue({ ...task, state: 'queued' }).catch(async () => {
        // Queue is overloaded — dead-letter rather than silently drop the task
        this._failedTotal++
        this._updateTaskState(task.id, 'failed', { failedAt: new Date().toISOString() })
        this._telemetry.increment('atc.tasks.failed_total')
        if (task.pluginId) this._telemetry.increment(`plugin.${task.pluginId}.tasks_failed`)
        await this._queue.sendToDeadLetter({ ...task, state: 'failed' }).catch(() => undefined)
        this._emitEvent('atc:task:failed', { taskId: task.id, type: task.type, pluginId: task.pluginId })
      })
      return
    }

    // Acquire distributed lease if configured — prevents duplicate execution across instances
    if (this._leaseManager) {
      const leaseAcquired = await this._leaseManager.acquireLease(task.id, this._instanceId)
      if (!leaseAcquired) {
        // Another instance is already processing this task — skip it
        return
      }
    }

    this._updateTaskState(task.id, 'running', { startedAt: new Date().toISOString() })
    const started = Date.now()
    this._emitEvent('atc:task:started', { taskId: task.id, type: task.type, pluginId: task.pluginId })

    try {
      const outcome = await worker.execute(task)
      const elapsed = Date.now() - started
      this._totalRuntimeMs += elapsed

      if (outcome === 'completed') {
        this._completedTotal++
        this._updateTaskState(task.id, 'completed', { completedAt: new Date().toISOString() })
        this._telemetry.increment('atc.tasks.completed_total')
        if (task.pluginId) {
          this._telemetry.increment(`plugin.${task.pluginId}.tasks_processed`)
        }
        this._emitEvent('atc:task:completed', { taskId: task.id, type: task.type, pluginId: task.pluginId, elapsedMs: elapsed })
      } else if (outcome === 'retry') {
        this._retriedTotal++
        const retryCount = task.retryCount + 1
        const delay = computeRetryDelayMs(task.retryPolicy, retryCount)
        const nextRetryAt = new Date(Date.now() + delay).toISOString()
        this._updateTaskState(task.id, 'retrying', { nextRetryAt })
        this._telemetry.increment('atc.tasks.retried_total')
        if (task.pluginId) {
          this._telemetry.increment(`plugin.${task.pluginId}.tasks_failed`)
        }
        this._emitEvent('atc:task:retrying', { taskId: task.id, type: task.type, pluginId: task.pluginId, retryCount, nextRetryAt })

        const retryTask: AtcTask = {
          ...task,
          state: 'queued',
          retryCount,
          scheduledAt: nextRetryAt,
          nextRetryAt: null,
        }
        await this._queue.scheduleDelayed(retryTask).catch(() => undefined)
      } else {
        // dead-letter
        this._failedTotal++
        this._updateTaskState(task.id, 'failed', { failedAt: new Date().toISOString() })
        this._telemetry.increment('atc.tasks.failed_total')
        if (task.pluginId) {
          this._telemetry.increment(`plugin.${task.pluginId}.tasks_failed`)
        }
        await this._queue.sendToDeadLetter({ ...task, state: 'failed' }).catch(() => undefined)
        this._emitEvent('atc:task:failed', { taskId: task.id, type: task.type, pluginId: task.pluginId })
      }
    } finally {
      if (this._leaseManager) {
        await this._leaseManager.releaseLease(task.id, this._instanceId).catch(() => undefined)
      }
    }
  }

  private _updateTaskState(
    taskId: string,
    state: AtcTask['state'],
    extra?: Partial<AtcTask>,
  ): void {
    const existing = this._activeTasks.get(taskId)
    if (!existing) return
    this._activeTasks.set(taskId, { ...existing, state, ...extra })
  }

  private _buildTask(opts: EnqueueOptions, scheduledAt: string | null = null): AtcTask {
    const policy: AtcRetryPolicy = {
      ...this._defaultRetryPolicy,
      ...(opts.retryPolicy ?? {}),
      ...(opts.maxRetries !== undefined ? { maxRetries: opts.maxRetries } : {}),
    }
    return {
      id: randomUUID(),
      pluginId: opts.pluginId ?? null,
      type: opts.type,
      payload: opts.payload ?? null,
      state: 'queued',
      retryPolicy: policy,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      scheduledAt,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      nextRetryAt: null,
      error: null,
      queueName: opts.queueName ?? DEFAULT_QUEUE,
      timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    }
  }

  private _validateType(type: string): void {
    if (!type || !TASK_TYPE_REGEX.test(type)) {
      throw new TaskTypeInvalidError(type)
    }
  }

  private _emitEvent(eventName: string, payload: Record<string, unknown>): void {
    this._eventBus.emit(eventName, payload).catch(() => undefined)
  }
}
