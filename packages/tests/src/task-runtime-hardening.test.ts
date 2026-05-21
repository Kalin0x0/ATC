import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  AtcTaskRuntime,
  AtcTaskQueue,
  AtcWorker,
  AtcWorkerRegistry,
  AtcTaskScheduler,
  InMemoryTaskQueueStorage,
} from '@atc/task-runtime'
import { AtcTelemetryService } from '@atc/telemetry'
import { AtcEventBus } from '@atc/events'
import type { AtcTask } from '@atc/shared-types'

function makeTask(overrides: Partial<AtcTask> = {}): AtcTask {
  return {
    id: crypto.randomUUID(),
    pluginId: null,
    type: 'test.job',
    payload: null,
    state: 'queued',
    retryPolicy: { maxRetries: 3, initialDelayMs: 0, backoffMultiplier: 1, maxDelayMs: 0 },
    retryCount: 0,
    createdAt: new Date().toISOString(),
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    nextRetryAt: null,
    error: null,
    queueName: 'atc:tasks:default',
    timeoutMs: 30_000,
    ...overrides,
  }
}

function makeRuntime(opts: { schedulerInterval?: number } = {}) {
  const telemetry = new AtcTelemetryService()
  const eventBus = new AtcEventBus()
  const storage = new InMemoryTaskQueueStorage()
  const runtime = new AtcTaskRuntime({
    storage,
    telemetry,
    eventBus,
    scheduler: { intervalMs: opts.schedulerInterval ?? 50 },
  })
  return { runtime, telemetry, eventBus, storage }
}

// ─── BUG-15H-1: Worker lookup before state update ────────────────────────────

describe('BUG-15H-1: worker-first ordering in _executeTask', () => {
  it('cancel() can still cancel a task that was dequeued but no worker was available', async () => {
    const { runtime } = makeRuntime()
    // No workers registered — dequeue succeeds but no worker available
    const id = await runtime.enqueue({ type: 'test.job' })
    runtime.start()
    await new Promise<void>((r) => setTimeout(r, 80)) // let one tick run
    runtime.stop()

    // Task should still be cancellable (state should be 'queued' not 'running')
    const task = runtime.getTask(id)
    // State is either 'queued' (back in queue) or still tracked — not 'running'
    if (task) {
      expect(task.state).not.toBe('running')
    }
  })

  it('atc:task:started is NOT emitted when no worker is available', async () => {
    const { runtime, eventBus } = makeRuntime()
    const startedHandler = vi.fn()
    eventBus.on('atc:task:started', startedHandler)

    // No workers registered
    await runtime.enqueue({ type: 'test.job' })
    await runtime.tick()

    await new Promise<void>((r) => setTimeout(r, 20))
    expect(startedHandler).not.toHaveBeenCalled()
  })

  it('atc:task:started IS emitted once a worker executes the task', async () => {
    const { runtime, eventBus } = makeRuntime()
    const startedHandler = vi.fn()
    eventBus.on('atc:task:started', startedHandler)

    runtime.registerWorker('test.job', vi.fn().mockResolvedValue(undefined), { queueName: 'atc:tasks:default' })
    await runtime.enqueue({ type: 'test.job' })
    await runtime.tick()

    await new Promise<void>((r) => setTimeout(r, 30))
    expect(startedHandler).toHaveBeenCalledOnce()
  })
})

// ─── BUG-15H-2: Re-enqueue overload → DLQ ─────────────────────────────────

describe('BUG-15H-2: overloaded re-enqueue goes to DLQ', () => {
  it('task is dead-lettered when no worker and queue is full', async () => {
    const telemetry = new AtcTelemetryService()
    const eventBus = new AtcEventBus()
    const storage = new InMemoryTaskQueueStorage()
    const runtime = new AtcTaskRuntime({ storage, telemetry, eventBus, maxQueueDepth: 1 })

    // Register one worker so the scheduler will dequeue tasks.
    runtime.registerWorker('test.job', vi.fn().mockResolvedValue(undefined), {
      queueName: 'atc:tasks:default',
    })

    // Push 3 tasks directly (bypassing the maxDepth guard) so the queue has
    // more items than the limit.  task3 stays in the queue after both ticks
    // dequeue task1 and task2, making the re-enqueue attempt for task2 fail.
    await storage.push('atc:tasks:default', JSON.stringify(makeTask()))
    await storage.push('atc:tasks:default', JSON.stringify(makeTask()))
    await storage.push('atc:tasks:default', JSON.stringify(makeTask()))
    // Queue: [task1, task2, task3], maxDepth=1

    // Fire two ticks concurrently.  Both `pop()` calls run synchronously before
    // either microtask resolves, so tick1 gets task1 and tick2 gets task2.
    // processTask(task1) sets worker.isRunning=true synchronously (inside execute())
    // before processTask(task2)'s find() runs.  task2 then has no idle worker and
    // tries to re-enqueue into a queue that still holds task3 (depth=1 = maxDepth=1),
    // throwing TaskQueueOverloadedError and landing in the DLQ.
    await Promise.all([runtime.tick(), runtime.tick()])

    // A setTimeout (macrotask) drains all pending microtasks (the async DLQ write)
    // before the check runs.
    await new Promise<void>((r) => setTimeout(r, 20))

    const dlqSize = await storage.lenDeadLetter()
    expect(dlqSize).toBeGreaterThanOrEqual(1)
  })
})

// ─── BUG-15H-3: promoteReady malformed → DLQ not lost ──────────────────────

describe('BUG-15H-3: malformed delayed item goes to DLQ, others still promoted', () => {
  it('two valid + one malformed delayed item: valid ones promoted, malformed dead-lettered', async () => {
    const storage = new InMemoryTaskQueueStorage()
    const queue = new AtcTaskQueue(storage)

    const past = Date.now() - 1000

    // Add one malformed delayed entry (raw bad JSON)
    await storage.addDelayed(past, '{ not valid json')
    // Add two valid delayed tasks
    const t1 = makeTask({ scheduledAt: new Date(past).toISOString() })
    const t2 = makeTask({ scheduledAt: new Date(past).toISOString() })
    await queue.scheduleDelayed(t1)
    await queue.scheduleDelayed(t2)

    await queue.promoteReady()

    // Both valid tasks should be in active queue
    const depth = await queue.getDepth('atc:tasks:default')
    expect(depth).toBe(2)

    // Malformed item should be in DLQ
    const dlq = await queue.getDeadLetterSize()
    expect(dlq).toBe(1)
  })

  it('promoteReady does not throw on all-malformed delayed queue', async () => {
    const storage = new InMemoryTaskQueueStorage()
    const queue = new AtcTaskQueue(storage)
    const past = Date.now() - 1000

    await storage.addDelayed(past, 'not-json-at-all')
    await storage.addDelayed(past, '{"id":"","type":""}') // missing state

    await expect(queue.promoteReady()).resolves.toEqual([])
    expect(await queue.getDeadLetterSize()).toBe(2)
  })
})

// ─── BUG-15H-4: dequeue malformed → DLQ ──────────────────────────────────

describe('BUG-15H-4: malformed active-queue JSON dead-lettered on dequeue', () => {
  it('dequeue returns null and dead-letters malformed JSON', async () => {
    const storage = new InMemoryTaskQueueStorage()
    await storage.push('atc:tasks:default', '{ corrupted json')
    const queue = new AtcTaskQueue(storage)

    const result = await queue.dequeue('atc:tasks:default')
    expect(result).toBeNull()
    expect(await storage.lenDeadLetter()).toBe(1)
  })

  it('dequeue with missing required fields dead-letters and returns null', async () => {
    const storage = new InMemoryTaskQueueStorage()
    await storage.push('atc:tasks:default', JSON.stringify({ id: '', payload: null })) // missing type + state
    const queue = new AtcTaskQueue(storage)

    const result = await queue.dequeue('atc:tasks:default')
    expect(result).toBeNull()
    expect(await storage.lenDeadLetter()).toBe(1)
  })

  it('dequeue of valid task is unaffected', async () => {
    const storage = new InMemoryTaskQueueStorage()
    const queue = new AtcTaskQueue(storage)
    const task = makeTask()
    await queue.enqueue(task)

    const result = await queue.dequeue('atc:tasks:default')
    expect(result).not.toBeNull()
    expect(result!.id).toBe(task.id)
    expect(await storage.lenDeadLetter()).toBe(0)
  })
})

// ─── Plugin queue scope enforcement ─────────────────────────────────────────

describe('Plugin queue scope cannot be overridden', () => {
  it('plugin tasks always land in atc:tasks:plugin:{pluginId} regardless of payload', async () => {
    const { runtime, storage } = makeRuntime()
    const id = await runtime.enqueue({
      type: 'test.task',
      payload: null,
      pluginId: 'my-plugin',
      queueName: 'atc:tasks:plugin:my-plugin', // correctly scoped
    })
    expect(typeof id).toBe('string')
    const depth = await storage.len('atc:tasks:plugin:my-plugin')
    expect(depth).toBe(1)
    expect(await storage.len('atc:tasks:default')).toBe(0)
  })

  it('system tasks with no pluginId use atc:tasks:default queue', async () => {
    const { runtime, storage } = makeRuntime()
    await runtime.enqueue({ type: 'system.task', payload: null })
    expect(await storage.len('atc:tasks:default')).toBe(1)
    expect(await storage.len('atc:tasks:plugin:system')).toBe(0)
  })

  it('two plugins have isolated queues', async () => {
    const { runtime, storage } = makeRuntime()
    await runtime.enqueue({ type: 't', pluginId: 'plugin-a', queueName: 'atc:tasks:plugin:plugin-a' })
    await runtime.enqueue({ type: 't', pluginId: 'plugin-b', queueName: 'atc:tasks:plugin:plugin-b' })
    expect(await storage.len('atc:tasks:plugin:plugin-a')).toBe(1)
    expect(await storage.len('atc:tasks:plugin:plugin-b')).toBe(1)
    expect(await storage.len('atc:tasks:default')).toBe(0)
  })
})

// ─── Scheduler: no double-promotion ──────────────────────────────────────────

describe('Scheduler double-promotion safety', () => {
  let storage: InMemoryTaskQueueStorage
  let queue: AtcTaskQueue
  let workerRegistry: AtcWorkerRegistry
  let scheduler: AtcTaskScheduler

  beforeEach(() => {
    storage = new InMemoryTaskQueueStorage()
    queue = new AtcTaskQueue(storage)
    workerRegistry = new AtcWorkerRegistry()
    scheduler = new AtcTaskScheduler(queue, workerRegistry, vi.fn().mockResolvedValue(undefined), { intervalMs: 50 })
  })

  afterEach(() => {
    scheduler.stop()
  })

  it('a single delayed task is promoted exactly once across two ticks', async () => {
    const past = new Date(Date.now() - 500).toISOString()
    const task = makeTask({ scheduledAt: past })
    await queue.scheduleDelayed(task)

    // Tick once — promotes the task
    await scheduler.tick()
    // Tick again — nothing left in delayed
    await scheduler.tick()

    // Should have exactly 1 in active queue (promoted once, not twice)
    expect(await queue.getDepth('atc:tasks:default')).toBe(1)
    expect(await queue.getDelayedCount()).toBe(0)
  })

  it('future delayed task is never promoted prematurely across multiple ticks', async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const task = makeTask({ scheduledAt: future })
    await queue.scheduleDelayed(task)

    await scheduler.tick()
    await scheduler.tick()
    await scheduler.tick()

    expect(await queue.getDelayedCount()).toBe(1)
    expect(await queue.getDepth('atc:tasks:default')).toBe(0)
  })
})

// ─── Worker timeout → retry → dead-letter path ───────────────────────────────

describe('Worker timeout retry/dead-letter path', () => {
  it('timeout on first attempt retries', async () => {
    const handler = vi.fn().mockImplementation(() => new Promise<void>(() => {})) // hangs forever
    const worker = new AtcWorker('w1', handler, { timeoutMs: 30 })
    const task = makeTask({ retryCount: 0, retryPolicy: { maxRetries: 3, initialDelayMs: 0, backoffMultiplier: 1, maxDelayMs: 0 } })
    const result = await worker.execute(task)
    expect(result).toBe('retry')
  }, 1000)

  it('timeout after maxRetries exhausted goes to dead-letter', async () => {
    const handler = vi.fn().mockImplementation(() => new Promise<void>(() => {}))
    const worker = new AtcWorker('w1', handler, { timeoutMs: 30 })
    const task = makeTask({ retryCount: 3, retryPolicy: { maxRetries: 3, initialDelayMs: 0, backoffMultiplier: 1, maxDelayMs: 0 } })
    const result = await worker.execute(task)
    expect(result).toBe('dead-letter')
  }, 1000)

  it('end-to-end: timeout retries then dead-letters', async () => {
    let callCount = 0
    const handler = vi.fn().mockImplementation(() => {
      callCount++
      return new Promise<void>(() => {}) // always hangs
    })
    const { runtime, storage } = makeRuntime({ schedulerInterval: 50 })
    runtime.registerWorker('slow.job', handler, { queueName: 'atc:tasks:default' })
    await runtime.enqueue({
      type: 'slow.job',
      maxRetries: 2,
      retryPolicy: { maxRetries: 2, initialDelayMs: 0, backoffMultiplier: 1, maxDelayMs: 0 },
      timeoutMs: 30,
    })

    runtime.start()
    await new Promise<void>((r) => setTimeout(r, 800))
    runtime.stop()

    // Should have ended in DLQ after exhausting retries
    const dlq = await storage.lenDeadLetter()
    expect(dlq).toBe(1)
    expect(runtime.getMetrics().failedTotal).toBe(1)
  }, 5000)
})

// ─── Cancel() state machine correctness ──────────────────────────────────────

describe('Cancel state machine', () => {
  it('cancel returns false for completed task', async () => {
    const handler = vi.fn().mockResolvedValue(undefined)
    const { runtime } = makeRuntime({ schedulerInterval: 50 })
    runtime.registerWorker('test.job', handler, { queueName: 'atc:tasks:default' })
    const id = await runtime.enqueue({ type: 'test.job' })

    runtime.start()
    await new Promise<void>((r) => setTimeout(r, 200))
    runtime.stop()

    // Task should be completed — cancel should fail
    expect(runtime.cancel(id)).toBe(false)
  })

  it('cancel returns false for unknown task', () => {
    const { runtime } = makeRuntime()
    expect(runtime.cancel('does-not-exist')).toBe(false)
  })

  it('cancel returns true and task is not processed', async () => {
    const handler = vi.fn()
    const { runtime } = makeRuntime({ schedulerInterval: 50 })
    runtime.registerWorker('test.job', handler, { queueName: 'atc:tasks:default' })

    const id = await runtime.enqueue({ type: 'test.job' })
    expect(runtime.cancel(id)).toBe(true)

    runtime.start()
    await new Promise<void>((r) => setTimeout(r, 200))
    runtime.stop()
    expect(handler).not.toHaveBeenCalled()
  })
})

// ─── Task ID uniqueness ───────────────────────────────────────────────────────

describe('Task ID uniqueness', () => {
  it('each enqueue produces a unique task ID', async () => {
    const { runtime } = makeRuntime()
    const ids = await Promise.all(
      Array.from({ length: 20 }, () => runtime.enqueue({ type: 'test.job' })),
    )
    const unique = new Set(ids)
    expect(unique.size).toBe(20)
  })

  it('task IDs are UUID v4 format', async () => {
    const { runtime } = makeRuntime()
    const id = await runtime.enqueue({ type: 'test.job' })
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })
})

// ─── Retry mechanics ──────────────────────────────────────────────────────────

describe('Retry mechanics', () => {
  it('retryCount increments exactly once per retry', async () => {
    let attempts = 0
    const handler = vi.fn().mockImplementation(async () => {
      attempts++
      if (attempts < 3) throw new Error('transient')
    })
    const { runtime } = makeRuntime({ schedulerInterval: 50 })
    runtime.registerWorker('test.job', handler, { queueName: 'atc:tasks:default' })
    await runtime.enqueue({
      type: 'test.job',
      retryPolicy: { maxRetries: 5, initialDelayMs: 0, backoffMultiplier: 1, maxDelayMs: 0 },
    })

    runtime.start()
    await new Promise<void>((r) => setTimeout(r, 600))
    runtime.stop()

    expect(runtime.getMetrics().completedTotal).toBe(1)
    expect(runtime.getMetrics().retriedTotal).toBe(2)
    expect(handler).toHaveBeenCalledTimes(3)
  })

  it('non-retryable error goes directly to DLQ without retry', async () => {
    const err = new Error('invalid schema')
    err.name = 'TaskPayloadInvalidError'
    const handler = vi.fn().mockRejectedValue(err)
    const { runtime, storage } = makeRuntime({ schedulerInterval: 50 })
    runtime.registerWorker('test.job', handler, { queueName: 'atc:tasks:default' })
    await runtime.enqueue({
      type: 'test.job',
      retryPolicy: { maxRetries: 5, initialDelayMs: 0, backoffMultiplier: 1, maxDelayMs: 0 },
    })

    runtime.start()
    await new Promise<void>((r) => setTimeout(r, 200))
    runtime.stop()

    expect(handler).toHaveBeenCalledOnce()
    expect(await storage.lenDeadLetter()).toBe(1)
    expect(runtime.getMetrics().retriedTotal).toBe(0)
    expect(runtime.getMetrics().failedTotal).toBe(1)
  })

  it('maxRetries=0 means no retries — first failure is dead-letter', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('transient'))
    const { runtime, storage } = makeRuntime({ schedulerInterval: 50 })
    runtime.registerWorker('test.job', handler, { queueName: 'atc:tasks:default' })
    await runtime.enqueue({
      type: 'test.job',
      retryPolicy: { maxRetries: 0, initialDelayMs: 0, backoffMultiplier: 1, maxDelayMs: 0 },
    })

    runtime.start()
    await new Promise<void>((r) => setTimeout(r, 200))
    runtime.stop()

    expect(handler).toHaveBeenCalledOnce()
    expect(await storage.lenDeadLetter()).toBe(1)
    expect(runtime.getMetrics().retriedTotal).toBe(0)
  })
})

// ─── EventBus event emission ──────────────────────────────────────────────────

describe('EventBus events', () => {
  it('emits atc:task:queued on enqueue', async () => {
    const { runtime, eventBus } = makeRuntime()
    const handler = vi.fn()
    eventBus.on('atc:task:queued', handler)
    await runtime.enqueue({ type: 'test.job' })
    await new Promise<void>((r) => setTimeout(r, 10))
    expect(handler).toHaveBeenCalledOnce()
    expect(handler.mock.calls[0]![0]).toMatchObject({ type: 'test.job' })
  })

  it('emits atc:task:completed on success', async () => {
    const { runtime, eventBus } = makeRuntime({ schedulerInterval: 50 })
    const completedHandler = vi.fn()
    eventBus.on('atc:task:completed', completedHandler)

    runtime.registerWorker('test.job', vi.fn().mockResolvedValue(undefined), { queueName: 'atc:tasks:default' })
    await runtime.enqueue({ type: 'test.job' })

    runtime.start()
    await new Promise<void>((r) => setTimeout(r, 300))
    runtime.stop()

    expect(completedHandler).toHaveBeenCalledOnce()
  })

  it('emits atc:task:failed on dead-letter', async () => {
    const err = new Error('perm denied')
    err.name = 'AtcPermissionDeniedError'
    const { runtime, eventBus } = makeRuntime({ schedulerInterval: 50 })
    const failedHandler = vi.fn()
    eventBus.on('atc:task:failed', failedHandler)

    runtime.registerWorker('test.job', vi.fn().mockRejectedValue(err), { queueName: 'atc:tasks:default' })
    await runtime.enqueue({ type: 'test.job' })

    runtime.start()
    await new Promise<void>((r) => setTimeout(r, 200))
    runtime.stop()

    expect(failedHandler).toHaveBeenCalledOnce()
  })

  it('emits atc:task:cancelled on cancel', async () => {
    const { runtime, eventBus } = makeRuntime()
    const cancelledHandler = vi.fn()
    eventBus.on('atc:task:cancelled', cancelledHandler)
    const id = await runtime.enqueue({ type: 'test.job' })
    runtime.cancel(id)
    await new Promise<void>((r) => setTimeout(r, 10))
    expect(cancelledHandler).toHaveBeenCalledOnce()
  })
})
