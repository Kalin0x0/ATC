import { describe, it, expect, beforeEach } from 'vitest'
import {
  AtcTaskQueue,
  InMemoryTaskQueueStorage,
  TaskPayloadInvalidError,
  TaskQueueOverloadedError,
} from '@atc/task-runtime'
import type { AtcTask } from '@atc/shared-types'

function makeTask(overrides: Partial<AtcTask> = {}): AtcTask {
  return {
    id: crypto.randomUUID(),
    pluginId: null,
    type: 'test.job',
    payload: { value: 42 },
    state: 'queued',
    retryPolicy: { maxRetries: 3, initialDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 30000 },
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

describe('InMemoryTaskQueueStorage', () => {
  let storage: InMemoryTaskQueueStorage

  beforeEach(() => {
    storage = new InMemoryTaskQueueStorage()
  })

  it('push and pop in FIFO order', async () => {
    await storage.push('q', 'a')
    await storage.push('q', 'b')
    await storage.push('q', 'c')
    expect(await storage.pop('q')).toBe('a')
    expect(await storage.pop('q')).toBe('b')
    expect(await storage.pop('q')).toBe('c')
    expect(await storage.pop('q')).toBeNull()
  })

  it('len returns correct count', async () => {
    await storage.push('q', 'x')
    await storage.push('q', 'y')
    expect(await storage.len('q')).toBe(2)
    await storage.pop('q')
    expect(await storage.len('q')).toBe(1)
  })

  it('dead letter push increments lenDeadLetter', async () => {
    await storage.pushToDeadLetter('dead')
    await storage.pushToDeadLetter('dead2')
    expect(await storage.lenDeadLetter()).toBe(2)
  })

  it('addDelayed and popReadyDelayed returns ready tasks', async () => {
    const past = Date.now() - 1000
    const future = Date.now() + 60_000
    await storage.addDelayed(past, 'ready')
    await storage.addDelayed(future, 'not-ready')

    const ready = await storage.popReadyDelayed(Date.now())
    expect(ready).toEqual(['ready'])
    expect(await storage.lenDelayed()).toBe(1)
  })

  it('popReadyDelayed respects limit', async () => {
    const past = Date.now() - 1000
    for (let i = 0; i < 5; i++) {
      await storage.addDelayed(past + i, `task${i}`)
    }
    const ready = await storage.popReadyDelayed(Date.now(), 3)
    expect(ready).toHaveLength(3)
    expect(await storage.lenDelayed()).toBe(2)
  })
})

describe('AtcTaskQueue', () => {
  let queue: AtcTaskQueue

  beforeEach(() => {
    queue = new AtcTaskQueue(new InMemoryTaskQueueStorage())
  })

  it('enqueue and dequeue round-trips a task', async () => {
    const task = makeTask()
    await queue.enqueue(task)
    const dequeued = await queue.dequeue('atc:tasks:default')
    expect(dequeued).not.toBeNull()
    expect(dequeued!.id).toBe(task.id)
    expect(dequeued!.type).toBe('test.job')
    expect(dequeued!.payload).toEqual({ value: 42 })
  })

  it('dequeue returns null on empty queue', async () => {
    const result = await queue.dequeue('empty-queue')
    expect(result).toBeNull()
  })

  it('enqueue respects max depth and throws TaskQueueOverloadedError', async () => {
    const smallQueue = new AtcTaskQueue(new InMemoryTaskQueueStorage(), 2)
    await smallQueue.enqueue(makeTask())
    await smallQueue.enqueue(makeTask())
    await expect(smallQueue.enqueue(makeTask())).rejects.toThrow(TaskQueueOverloadedError)
  })

  it('scheduleDelayed and promoteReady moves tasks to queue', async () => {
    const past = new Date(Date.now() - 1000).toISOString()
    const task = makeTask({ scheduledAt: past })
    await queue.scheduleDelayed(task)
    expect(await queue.getDelayedCount()).toBe(1)

    const promoted = await queue.promoteReady()
    expect(promoted).toHaveLength(1)
    expect(promoted[0]!.id).toBe(task.id)

    // Should now be in the active queue
    const dequeued = await queue.dequeue('atc:tasks:default')
    expect(dequeued).not.toBeNull()
    expect(dequeued!.id).toBe(task.id)
  })

  it('future delayed tasks are not promoted', async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const task = makeTask({ scheduledAt: future })
    await queue.scheduleDelayed(task)

    const promoted = await queue.promoteReady()
    expect(promoted).toHaveLength(0)
  })

  it('sendToDeadLetter increments dead letter size', async () => {
    const task = makeTask({ state: 'failed' })
    await queue.sendToDeadLetter(task)
    expect(await queue.getDeadLetterSize()).toBe(1)
  })

  it('getDepth reflects queue length', async () => {
    await queue.enqueue(makeTask())
    await queue.enqueue(makeTask())
    expect(await queue.getDepth('atc:tasks:default')).toBe(2)
  })

  it('dequeue dead-letters malformed JSON and returns null instead of throwing', async () => {
    const storage = new InMemoryTaskQueueStorage()
    await storage.push('q', '{ bad json')
    const q = new AtcTaskQueue(storage)
    const result = await q.dequeue('q')
    expect(result).toBeNull()
    // Malformed item preserved in DLQ rather than silently dropped
    expect(await q.getDeadLetterSize()).toBe(1)
  })
})
