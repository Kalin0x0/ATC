import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  AtcTaskRuntime,
  InMemoryTaskQueueStorage,
  TaskTypeInvalidError,
} from '@atc/task-runtime'
import { AtcTelemetryService } from '@atc/telemetry'
import { AtcEventBus } from '@atc/events'

function makeRuntime(opts: { schedulerInterval?: number } = {}) {
  const telemetry = new AtcTelemetryService()
  const eventBus = new AtcEventBus()
  const storage = new InMemoryTaskQueueStorage()
  const runtime = new AtcTaskRuntime({
    storage,
    telemetry,
    eventBus,
    scheduler: { intervalMs: opts.schedulerInterval ?? 100 },
  })
  return { runtime, telemetry, eventBus, storage }
}

describe('AtcTaskRuntime — enqueue', () => {
  it('returns a task ID string', async () => {
    const { runtime } = makeRuntime()
    const id = await runtime.enqueue({ type: 'test.job', payload: { x: 1 } })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('throws TaskTypeInvalidError for invalid type', async () => {
    const { runtime } = makeRuntime()
    await expect(runtime.enqueue({ type: 'INVALID TYPE!', payload: null })).rejects.toThrow(TaskTypeInvalidError)
  })

  it('throws for empty type', async () => {
    const { runtime } = makeRuntime()
    await expect(runtime.enqueue({ type: '', payload: null })).rejects.toThrow(TaskTypeInvalidError)
  })

  it('accepts valid type characters (dots, dashes, underscores)', async () => {
    const { runtime } = makeRuntime()
    const id = await runtime.enqueue({ type: 'my.plugin.task-v2_final', payload: null })
    expect(id).toBeDefined()
  })

  it('increments queuedTotal metric', async () => {
    const { runtime, telemetry } = makeRuntime()
    await runtime.enqueue({ type: 'test.job' })
    await runtime.enqueue({ type: 'test.job' })
    const m = telemetry.get('atc.tasks.queued_total')
    expect(m?.value).toBe(2)
  })

  it('emits atc:task:queued event', async () => {
    const { runtime, eventBus } = makeRuntime()
    const handler = vi.fn()
    eventBus.on('atc:task:queued', handler)
    await runtime.enqueue({ type: 'test.job' })
    await new Promise<void>((r) => setTimeout(r, 10))
    expect(handler).toHaveBeenCalledOnce()
    expect(handler.mock.calls[0]![0]).toMatchObject({ type: 'test.job' })
  })
})

describe('AtcTaskRuntime — schedule', () => {
  it('schedules a delayed task and returns task ID', async () => {
    const { runtime } = makeRuntime()
    const id = await runtime.schedule({ type: 'delayed.job', delayMs: 5000 })
    expect(typeof id).toBe('string')
  })

  it('delayed task is not immediately dequeued', async () => {
    const { runtime, storage } = makeRuntime()
    await runtime.schedule({ type: 'delayed.job', delayMs: 60_000 })
    // Should be in delayed set, not active queue
    const inDefault = await storage.len('atc:tasks:default')
    expect(inDefault).toBe(0)
    const delayed = await storage.lenDelayed()
    expect(delayed).toBe(1)
  })
})

describe('AtcTaskRuntime — cancel', () => {
  it('returns true when cancelling a queued task', async () => {
    const { runtime } = makeRuntime()
    const id = await runtime.enqueue({ type: 'test.job' })
    expect(runtime.cancel(id)).toBe(true)
  })

  it('returns false for unknown task ID', () => {
    const { runtime } = makeRuntime()
    expect(runtime.cancel('non-existent-id')).toBe(false)
  })

  it('cancelled task is not processed', async () => {
    const handler = vi.fn()
    const { runtime } = makeRuntime({ schedulerInterval: 50 })
    runtime.registerWorker('test.job', handler, { queueName: 'atc:tasks:default' })

    const id = await runtime.enqueue({ type: 'test.job' })
    runtime.cancel(id)
    runtime.start()
    await new Promise<void>((r) => setTimeout(r, 200))
    runtime.stop()

    expect(handler).not.toHaveBeenCalled()
  })
})

describe('AtcTaskRuntime — registerWorker', () => {
  it('returns a worker ID string', () => {
    const { runtime } = makeRuntime()
    const id = runtime.registerWorker('test.job', vi.fn())
    expect(typeof id).toBe('string')
    expect(id.startsWith('worker-test.job-')).toBe(true)
  })

  it('increments active_workers telemetry', () => {
    const { runtime, telemetry } = makeRuntime()
    runtime.registerWorker('test.job', vi.fn())
    runtime.registerWorker('test.job2', vi.fn())
    const m = telemetry.get('atc.tasks.active_workers')
    expect(m?.value).toBe(2)
  })
})

describe('AtcTaskRuntime — process loop', () => {
  afterEach(() => {
    // Ensure timers are stopped between tests
  })

  it('processes a queued task end-to-end', async () => {
    const handler = vi.fn().mockResolvedValue(undefined)
    const { runtime } = makeRuntime({ schedulerInterval: 50 })
    runtime.registerWorker('test.job', handler, { queueName: 'atc:tasks:default' })
    await runtime.enqueue({ type: 'test.job', payload: { data: 'hello' } })

    runtime.start()
    await new Promise<void>((r) => setTimeout(r, 300))
    runtime.stop()

    expect(handler).toHaveBeenCalledOnce()
    const metrics = runtime.getMetrics()
    expect(metrics.completedTotal).toBe(1)
    expect(metrics.queuedTotal).toBe(1)
  })

  it('dead-letters non-retryable failures', async () => {
    const err = new Error('invalid payload')
    err.name = 'TaskPayloadInvalidError'
    const handler = vi.fn().mockRejectedValue(err)
    const { runtime, storage } = makeRuntime({ schedulerInterval: 50 })
    runtime.registerWorker('test.job', handler, { queueName: 'atc:tasks:default' })
    await runtime.enqueue({ type: 'test.job' })

    runtime.start()
    await new Promise<void>((r) => setTimeout(r, 300))
    runtime.stop()

    const dlqSize = await storage.lenDeadLetter()
    expect(dlqSize).toBe(1)
    expect(runtime.getMetrics().failedTotal).toBe(1)
  })

  it('retries retryable failures', async () => {
    let callCount = 0
    const handler = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount < 3) throw new Error('transient')
    })

    const { runtime } = makeRuntime({ schedulerInterval: 50 })
    runtime.registerWorker('test.job', handler, { queueName: 'atc:tasks:default' })
    await runtime.enqueue({
      type: 'test.job',
      maxRetries: 5,
      retryPolicy: { maxRetries: 5, initialDelayMs: 0, backoffMultiplier: 1, maxDelayMs: 0 },
    })

    runtime.start()
    await new Promise<void>((r) => setTimeout(r, 600))
    runtime.stop()

    expect(runtime.getMetrics().retriedTotal).toBeGreaterThan(0)
    expect(runtime.getMetrics().completedTotal).toBe(1)
  })
})

describe('AtcTaskRuntime — getMetrics', () => {
  it('initial metrics are all zeros', () => {
    const { runtime } = makeRuntime()
    const m = runtime.getMetrics()
    expect(m.queuedTotal).toBe(0)
    expect(m.completedTotal).toBe(0)
    expect(m.failedTotal).toBe(0)
    expect(m.retriedTotal).toBe(0)
    expect(m.activeWorkers).toBe(0)
    expect(m.avgRuntimeMs).toBe(0)
  })

  it('getWorkerMetrics returns all worker metrics', () => {
    const { runtime } = makeRuntime()
    runtime.registerWorker('job.a', vi.fn(), { queueName: 'q1' })
    runtime.registerWorker('job.b', vi.fn(), { queueName: 'q2' })
    const workers = runtime.getWorkerMetrics()
    expect(workers).toHaveLength(2)
    expect(workers.map((w) => w.queueName)).toContain('q1')
    expect(workers.map((w) => w.queueName)).toContain('q2')
  })
})

describe('AtcTaskRuntime — scheduler lifecycle', () => {
  it('start/stop are idempotent', () => {
    const { runtime } = makeRuntime()
    runtime.start()
    runtime.start() // second call is no-op
    expect(runtime.isRunning).toBe(true)
    runtime.stop()
    runtime.stop() // second call is no-op
    expect(runtime.isRunning).toBe(false)
  })
})
