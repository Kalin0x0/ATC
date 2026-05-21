import { describe, it, expect, vi } from 'vitest'
import {
  AtcTaskRuntime,
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
    payload: { value: 1 },
    state: 'queued',
    retryPolicy: { maxRetries: 0, initialDelayMs: 0, backoffMultiplier: 1, maxDelayMs: 0 },
    retryCount: 0,
    createdAt: new Date().toISOString(),
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    failedAt: new Date().toISOString(),
    nextRetryAt: null,
    error: 'Worker rejected',
    queueName: 'atc:tasks:default',
    timeoutMs: 30_000,
    ...overrides,
  }
}

function makeRuntime() {
  const telemetry = new AtcTelemetryService()
  const eventBus = new AtcEventBus()
  const storage = new InMemoryTaskQueueStorage()
  const runtime = new AtcTaskRuntime({ storage, telemetry, eventBus })
  return { runtime, storage, telemetry, eventBus }
}

// ── listDeadLetter ────────────────────────────────────────────────────────────

describe('AtcTaskRuntime.listDeadLetter', () => {
  it('returns empty page when DLQ is empty', async () => {
    const { runtime } = makeRuntime()
    const page = await runtime.listDeadLetter()
    expect(page.items).toHaveLength(0)
    expect(page.total).toBe(0)
    expect(page.offset).toBe(0)
    expect(page.limit).toBe(20)
  })

  it('returns tasks sent to the dead-letter queue', async () => {
    const { runtime } = makeRuntime()
    const task = makeTask({ state: 'failed' })
    // Enqueue a task then manually dead-letter it via the runtime
    await runtime.enqueue({ type: task.type, queueName: task.queueName })
    // Send directly via the internal queue helper
    // Use requeueDeadLetterTask to confirm round-trip, so first populate via storage
    const { storage } = makeRuntime()
    await storage.pushToDeadLetter(JSON.stringify(task))
    const runtime2 = new AtcTaskRuntime({ storage, telemetry: new AtcTelemetryService(), eventBus: new AtcEventBus() })
    const page = await runtime2.listDeadLetter()
    expect(page.total).toBe(1)
    expect(page.items[0]?.id).toBe(task.id)
  })

  it('paginates correctly with limit and offset', async () => {
    const { storage } = makeRuntime()
    for (let i = 0; i < 5; i++) {
      await storage.pushToDeadLetter(JSON.stringify(makeTask()))
    }
    const runtime = new AtcTaskRuntime({ storage, telemetry: new AtcTelemetryService(), eventBus: new AtcEventBus() })
    const page1 = await runtime.listDeadLetter(2, 0)
    const page2 = await runtime.listDeadLetter(2, 2)
    expect(page1.items).toHaveLength(2)
    expect(page2.items).toHaveLength(2)
    expect(page1.total).toBe(5)
    expect(page1.items[0]?.id).not.toBe(page2.items[0]?.id)
  })
})

// ── requeueDeadLetterTask ─────────────────────────────────────────────────────

describe('AtcTaskRuntime.requeueDeadLetterTask', () => {
  it('returns false when task is not in DLQ', async () => {
    const { runtime } = makeRuntime()
    const result = await runtime.requeueDeadLetterTask(crypto.randomUUID())
    expect(result).toBe(false)
  })

  it('requeues a task from DLQ to the active queue', async () => {
    const { storage } = makeRuntime()
    const task = makeTask({ state: 'failed' })
    await storage.pushToDeadLetter(JSON.stringify(task))

    const runtime = new AtcTaskRuntime({ storage, telemetry: new AtcTelemetryService(), eventBus: new AtcEventBus() })
    const result = await runtime.requeueDeadLetterTask(task.id)
    expect(result).toBe(true)

    // Task should be removed from DLQ
    const dlqSize = await storage.lenDeadLetter()
    expect(dlqSize).toBe(0)

    // Task should be in the active queue
    const queueLen = await storage.len(task.queueName)
    expect(queueLen).toBe(1)
  })

  it('is idempotent — second call returns false', async () => {
    const { storage } = makeRuntime()
    const task = makeTask({ state: 'failed' })
    await storage.pushToDeadLetter(JSON.stringify(task))

    const runtime = new AtcTaskRuntime({ storage, telemetry: new AtcTelemetryService(), eventBus: new AtcEventBus() })
    const first = await runtime.requeueDeadLetterTask(task.id)
    const second = await runtime.requeueDeadLetterTask(task.id)
    expect(first).toBe(true)
    expect(second).toBe(false)
  })

  it('emits atc:task:requeued event on success', async () => {
    const { storage } = makeRuntime()
    const task = makeTask({ state: 'failed' })
    await storage.pushToDeadLetter(JSON.stringify(task))

    const eventBus = new AtcEventBus()
    const handler = vi.fn()
    eventBus.on('atc:task:requeued', handler)

    const runtime = new AtcTaskRuntime({ storage, telemetry: new AtcTelemetryService(), eventBus })
    await runtime.requeueDeadLetterTask(task.id)

    await new Promise<void>((r) => setTimeout(r, 10))
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ taskId: task.id }))
  })

  it('increments ops.dlq_requeues_total telemetry counter', async () => {
    const { storage } = makeRuntime()
    const task = makeTask({ state: 'failed' })
    await storage.pushToDeadLetter(JSON.stringify(task))

    const telemetry = new AtcTelemetryService()
    const runtime = new AtcTaskRuntime({ storage, telemetry, eventBus: new AtcEventBus() })
    await runtime.requeueDeadLetterTask(task.id)

    const snap = telemetry.snapshot()
    const metric = snap.metrics.find((m) => m.name === 'ops.dlq_requeues_total')
    expect(metric?.value).toBe(1)
  })
})
