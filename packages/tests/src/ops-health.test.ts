import { describe, it, expect, vi } from 'vitest'
import { AtcHealthService } from '@atc/operations'
import type {
  DbCheckable,
  RedisCheckable,
  EventBusCheckable,
  TaskRuntimeCheckable,
  EventStoreCheckable,
  PluginRuntimeCheckable,
} from '@atc/operations'

function makeDb(opts: { fail?: boolean } = {}): DbCheckable {
  return {
    getConnection: async () => {
      if (opts.fail) throw new Error('Connection refused')
      return {
        ping: async () => { /* ok */ },
        release: () => { /* ok */ },
      }
    },
  }
}

function makeRedis(opts: { response?: string; fail?: boolean } = {}): RedisCheckable {
  return {
    ping: async () => {
      if (opts.fail) throw new Error('NOAUTH')
      return opts.response ?? 'PONG'
    },
  }
}

function makeEventBus(opts: { failRate?: number } = {}): EventBusCheckable {
  const emitted = 100
  const failed = Math.round((opts.failRate ?? 0) * emitted)
  return {
    getMetrics: () => ({
      emittedTotal: emitted,
      handledTotal: emitted - failed,
      failedTotal: failed,
      avgDurationMs: 1,
      activeSubscribers: 3,
      metricsEnabled: true,
    }),
  }
}

function makeTaskRuntime(opts: { isRunning?: boolean } = {}): TaskRuntimeCheckable {
  return {
    getMetrics: () => ({
      queuedTotal: 10,
      completedTotal: 8,
      failedTotal: 1,
      activeWorkers: 2,
      avgRuntimeMs: 50,
    }),
    isRunning: opts.isRunning ?? true,
  }
}

function makeEventStore(): EventStoreCheckable {
  return { getAllStreamNames: () => ['stream.a', 'stream.b'] }
}

function makePluginRuntime(): PluginRuntimeCheckable {
  return {
    getAll: () => [
      { id: 'plugin-a', status: 'enabled', healthStatus: 'healthy', failureCount: 0 },
      { id: 'plugin-b', status: 'enabled', healthStatus: 'healthy', failureCount: 0 },
    ],
  }
}

function makeService(overrides: Partial<{
  db: DbCheckable
  redis: RedisCheckable
  eventBus: EventBusCheckable
  taskRuntime: TaskRuntimeCheckable
  eventStore: EventStoreCheckable
  pluginRuntime: PluginRuntimeCheckable
}> = {}) {
  return new AtcHealthService({
    db: makeDb(),
    redis: makeRedis(),
    eventBus: makeEventBus(),
    taskRuntime: makeTaskRuntime(),
    eventStore: makeEventStore(),
    pluginRuntime: makePluginRuntime(),
    checkTimeoutMs: 1_000,
    ...overrides,
  })
}

// ── checkDb ───────────────────────────────────────────────────────────────────

describe('AtcHealthService.checkDb', () => {
  it('returns healthy when ping succeeds', async () => {
    const svc = makeService()
    const result = await svc.checkDb()
    expect(result.status).toBe('healthy')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(result.lastCheckedAt).toBeTruthy()
  })

  it('returns failed when getConnection throws', async () => {
    const svc = makeService({ db: makeDb({ fail: true }) })
    const result = await svc.checkDb()
    expect(result.status).toBe('failed')
    expect(result.message).toContain('Connection refused')
  })

  it('returns failed when check times out', async () => {
    const svc = makeService({
      db: {
        getConnection: async () => {
          await new Promise((r) => setTimeout(r, 500))
          return { ping: async () => {}, release: () => {} }
        },
      },
      checkTimeoutMs: 10,
    } as never)
    const result = await svc.checkDb()
    expect(result.status).toBe('failed')
    expect(result.message).toContain('timed out')
  })
})

// ── checkRedis ────────────────────────────────────────────────────────────────

describe('AtcHealthService.checkRedis', () => {
  it('returns healthy on PONG', async () => {
    const result = await makeService().checkRedis()
    expect(result.status).toBe('healthy')
  })

  it('returns degraded on unexpected PING response', async () => {
    const svc = makeService({ redis: makeRedis({ response: 'NOPE' }) })
    const result = await svc.checkRedis()
    expect(result.status).toBe('degraded')
  })

  it('returns failed when ping throws', async () => {
    const svc = makeService({ redis: makeRedis({ fail: true }) })
    const result = await svc.checkRedis()
    expect(result.status).toBe('failed')
  })
})

// ── checkEventBus ─────────────────────────────────────────────────────────────

describe('AtcHealthService.checkEventBus', () => {
  it('returns healthy when fail rate is low', async () => {
    const result = await makeService({ eventBus: makeEventBus({ failRate: 0.05 }) }).checkEventBus()
    expect(result.status).toBe('healthy')
  })

  it('returns degraded when fail rate exceeds 10%', async () => {
    const result = await makeService({ eventBus: makeEventBus({ failRate: 0.15 }) }).checkEventBus()
    expect(result.status).toBe('degraded')
  })

  it('includes emittedTotal and activeSubscribers in metadata', async () => {
    const result = await makeService().checkEventBus()
    expect(result.metadata?.emittedTotal).toBe(100)
    expect(result.metadata?.activeSubscribers).toBe(3)
  })
})

// ── checkTaskRuntime ──────────────────────────────────────────────────────────

describe('AtcHealthService.checkTaskRuntime', () => {
  it('returns healthy when isRunning=true', async () => {
    const result = await makeService().checkTaskRuntime()
    expect(result.status).toBe('healthy')
  })

  it('returns degraded when isRunning=false', async () => {
    const svc = makeService({ taskRuntime: makeTaskRuntime({ isRunning: false }) })
    const result = await svc.checkTaskRuntime()
    expect(result.status).toBe('degraded')
    expect(result.message).toContain('not running')
  })
})

// ── checkEventStore ───────────────────────────────────────────────────────────

describe('AtcHealthService.checkEventStore', () => {
  it('returns healthy and includes streamCount', async () => {
    const result = await makeService().checkEventStore()
    expect(result.status).toBe('healthy')
    expect(result.metadata?.streamCount).toBe(2)
  })
})

// ── checkPluginRuntime ────────────────────────────────────────────────────────

describe('AtcHealthService.checkPluginRuntime', () => {
  it('returns healthy when no plugins are failed or degraded', async () => {
    const result = await makeService().checkPluginRuntime()
    expect(result.status).toBe('healthy')
    expect(result.metadata?.total).toBe(2)
    expect(result.metadata?.failed).toBe(0)
  })

  it('returns degraded when a plugin has failed status', async () => {
    const svc = makeService({
      pluginRuntime: {
        getAll: () => [
          { id: 'p1', status: 'failed', healthStatus: 'failed', failureCount: 5 },
        ],
      },
    })
    const result = await svc.checkPluginRuntime()
    expect(result.status).toBe('degraded')
    expect(result.metadata?.failed).toBe(1)
  })
})

// ── getSnapshot ───────────────────────────────────────────────────────────────

describe('AtcHealthService.getSnapshot', () => {
  it('returns healthy when all subsystems are healthy', async () => {
    const snap = await makeService().getSnapshot()
    expect(snap.status).toBe('healthy')
    expect(Object.keys(snap.subsystems)).toContain('db')
    expect(Object.keys(snap.subsystems)).toContain('redis')
    expect(Object.keys(snap.subsystems)).toContain('api')
    expect(snap.checkedAt).toBeTruthy()
  })

  it('returns failed when a critical subsystem (db) fails', async () => {
    const snap = await makeService({ db: makeDb({ fail: true }) }).getSnapshot()
    expect(snap.status).toBe('failed')
    expect(snap.subsystems.db.status).toBe('failed')
  })

  it('returns failed when redis fails', async () => {
    const snap = await makeService({ redis: makeRedis({ fail: true }) }).getSnapshot()
    expect(snap.status).toBe('failed')
  })

  it('returns degraded (not failed) when only a non-critical subsystem fails', async () => {
    const svc = makeService({
      eventBus: {
        getMetrics: () => {
          throw new Error('bus down')
        },
      },
    })
    const snap = await svc.getSnapshot()
    expect(snap.status).toBe('degraded')
    expect(snap.subsystems.db.status).toBe('healthy')
  })

  it('runs all checks concurrently (no check blocks another)', async () => {
    let calls = 0
    const svc = new AtcHealthService({
      db: { getConnection: async () => { calls++; return { ping: async () => {}, release: () => {} } } },
      redis: { ping: async () => { calls++; return 'PONG' } },
      eventBus: makeEventBus(),
      taskRuntime: makeTaskRuntime(),
      eventStore: makeEventStore(),
      pluginRuntime: makePluginRuntime(),
    })
    await svc.getSnapshot()
    expect(calls).toBe(2)
  })
})
