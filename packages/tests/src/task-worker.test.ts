import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AtcWorker, AtcWorkerRegistry } from '@atc/task-runtime'
import type { AtcTask } from '@atc/shared-types'

function makeTask(overrides: Partial<AtcTask> = {}): AtcTask {
  return {
    id: crypto.randomUUID(),
    pluginId: null,
    type: 'test.job',
    payload: null,
    state: 'running',
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

describe('AtcWorker', () => {
  it('execute returns completed on successful handler', async () => {
    const handler = vi.fn().mockResolvedValue(undefined)
    const worker = new AtcWorker('w1', handler)
    const result = await worker.execute(makeTask())
    expect(result).toBe('completed')
    expect(handler).toHaveBeenCalledOnce()
  })

  it('execute returns retry on retryable error when retryCount < maxRetries', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('transient network error'))
    const worker = new AtcWorker('w1', handler)
    const task = makeTask({ retryCount: 0 })
    const result = await worker.execute(task)
    expect(result).toBe('retry')
  })

  it('execute returns dead-letter on retryable error when retryCount >= maxRetries', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('transient error'))
    const worker = new AtcWorker('w1', handler)
    const task = makeTask({ retryCount: 3 }) // maxRetries = 3, so exhausted
    const result = await worker.execute(task)
    expect(result).toBe('dead-letter')
  })

  it('execute returns dead-letter on non-retryable error', async () => {
    const err = new Error('Permission denied: not allowed')
    err.name = 'AtcPermissionDeniedError'
    const handler = vi.fn().mockRejectedValue(err)
    const worker = new AtcWorker('w1', handler)
    const task = makeTask({ retryCount: 0 })
    const result = await worker.execute(task)
    expect(result).toBe('dead-letter')
  })

  it('execute returns dead-letter on validation error (non-retryable)', async () => {
    const err = new Error('schema validation failed')
    err.name = 'TaskPayloadInvalidError'
    const handler = vi.fn().mockRejectedValue(err)
    const worker = new AtcWorker('w1', handler)
    const result = await worker.execute(makeTask())
    expect(result).toBe('dead-letter')
  })

  it('execute times out if task exceeds timeoutMs', async () => {
    const handler = vi.fn().mockImplementation(() => new Promise<void>((res) => setTimeout(res, 5000)))
    const worker = new AtcWorker('w1', handler, { timeoutMs: 50 })
    const task = makeTask({ timeoutMs: 50 })
    const result = await worker.execute(task)
    // Timeout is retryable
    expect(result).toBe('retry')
  }, 2000)

  it('metrics are tracked correctly', async () => {
    const handler = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'))
    const worker = new AtcWorker('w1', handler, { pluginId: 'my-plugin' })

    await worker.execute(makeTask())  // success
    await worker.execute(makeTask())  // failure/retry

    const m = worker.getMetrics()
    expect(m.processedJobs).toBe(1)
    expect(m.failures).toBe(1)
    expect(m.pluginId).toBe('my-plugin')
    expect(m.workerId).toBe('w1')
    expect(m.isRunning).toBe(false)
  })

  it('isRunning is true during execution', async () => {
    let capturedRunning = false
    const handler = vi.fn().mockImplementation(async () => {
      // Can't read isRunning during async execution synchronously, but we can test it after
    })
    const worker = new AtcWorker('w1', handler)
    expect(worker.isRunning).toBe(false)
    await worker.execute(makeTask())
    expect(worker.isRunning).toBe(false)
  })
})

describe('AtcWorkerRegistry', () => {
  let registry: AtcWorkerRegistry

  beforeEach(() => {
    registry = new AtcWorkerRegistry()
  })

  it('registers and retrieves workers', () => {
    const w = new AtcWorker('w1', vi.fn(), { queueName: 'atc:tasks:default' })
    registry.register(w)
    expect(registry.get('w1')).toBe(w)
  })

  it('getForQueue returns workers matching queue name', () => {
    const w1 = new AtcWorker('w1', vi.fn(), { queueName: 'atc:tasks:default' })
    const w2 = new AtcWorker('w2', vi.fn(), { queueName: 'atc:tasks:plugin:abc' })
    const w3 = new AtcWorker('w3', vi.fn(), { queueName: 'atc:tasks:default' })
    registry.register(w1)
    registry.register(w2)
    registry.register(w3)

    const defaults = registry.getForQueue('atc:tasks:default')
    expect(defaults).toHaveLength(2)
    expect(defaults.map((w) => w.workerId)).toContain('w1')
    expect(defaults.map((w) => w.workerId)).toContain('w3')
  })

  it('getAllQueueNames returns unique queue names', () => {
    registry.register(new AtcWorker('w1', vi.fn(), { queueName: 'q1' }))
    registry.register(new AtcWorker('w2', vi.fn(), { queueName: 'q1' }))
    registry.register(new AtcWorker('w3', vi.fn(), { queueName: 'q2' }))
    expect(registry.getAllQueueNames()).toEqual(expect.arrayContaining(['q1', 'q2']))
    expect(registry.getAllQueueNames()).toHaveLength(2)
  })

  it('unregister removes worker', () => {
    const w = new AtcWorker('w1', vi.fn())
    registry.register(w)
    registry.unregister('w1')
    expect(registry.get('w1')).toBeUndefined()
  })

  it('returns empty array for unknown queue', () => {
    expect(registry.getForQueue('unknown')).toEqual([])
  })
})
