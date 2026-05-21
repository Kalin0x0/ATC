import type { AtcTask } from '@atc/shared-types'
import type { AtcTaskQueue } from './queue.js'
import type { AtcWorkerRegistry } from './worker.js'
import type { AtcSchedulerLeaderElection } from './leader.js'

export interface SchedulerOptions {
  intervalMs?: number
  staleTaskThresholdMs?: number
  /** Optional leader election — if set, only the leader runs scheduler ticks */
  leaderElection?: AtcSchedulerLeaderElection
}

export class AtcTaskScheduler {
  private _running = false
  private _timer: ReturnType<typeof setInterval> | null = null
  private readonly _intervalMs: number
  private readonly _leaderElection: AtcSchedulerLeaderElection | undefined

  constructor(
    private readonly _queue: AtcTaskQueue,
    private readonly _workerRegistry: AtcWorkerRegistry,
    private readonly _processTask: (task: AtcTask) => Promise<void>,
    opts: SchedulerOptions = {},
  ) {
    this._intervalMs = opts.intervalMs ?? 1_000
    this._leaderElection = opts.leaderElection
  }

  get isRunning(): boolean { return this._running }

  start(): void {
    if (this._running) return
    this._running = true
    this._timer = setInterval(() => {
      // Overlap-safe: each tick fires independently; no await blocks future ticks
      void this._tick().catch(() => undefined)
    }, this._intervalMs)
  }

  stop(): void {
    if (!this._running) return
    this._running = false
    if (this._timer !== null) {
      clearInterval(this._timer)
      this._timer = null
    }
  }

  // Exposed for testing — runs one scheduler tick
  async tick(): Promise<void> {
    return this._tick()
  }

  private async _tick(): Promise<void> {
    // Skip if leader election is configured and we are not the leader
    if (this._leaderElection !== undefined && !this._leaderElection.isLeader) return

    // 1. Promote delayed tasks that are ready
    await this._queue.promoteReady().catch(() => undefined)

    // 2. For each known queue, pop and process one task per idle worker
    const queueNames = [
      ...new Set([
        ...this._queue.getAllQueueNames(),
        ...this._workerRegistry.getAllQueueNames(),
      ]),
    ]

    for (const queueName of queueNames) {
      const workers = this._workerRegistry.getForQueue(queueName)
      for (const worker of workers) {
        if (worker.isRunning) continue
        const task = await this._queue.dequeue(queueName).catch(() => null)
        if (!task) break
        // Fire-and-forget per task — errors handled inside processTask
        void this._processTask(task).catch(() => undefined)
        break // One task per worker per tick
      }
    }
  }
}
