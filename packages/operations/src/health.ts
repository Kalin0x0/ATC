import type {
  AtcRuntimeHealthStatus,
  AtcSubsystemHealth,
  AtcRuntimeHealthSnapshot,
} from '@atc/shared-types'

// Duck-typed interfaces — satisfied by the real implementations without importing them
export interface DbCheckable {
  getConnection(): Promise<{ ping(): Promise<void>; release(): void }>
}

export interface RedisCheckable {
  ping(): Promise<string>
}

export interface EventBusCheckable {
  getMetrics(): {
    emittedTotal: number
    handledTotal: number
    failedTotal: number
    avgDurationMs: number
    activeSubscribers: number
    metricsEnabled: boolean
  }
}

export interface TaskRuntimeCheckable {
  getMetrics(): {
    queuedTotal: number
    completedTotal: number
    failedTotal: number
    activeWorkers: number
    avgRuntimeMs: number
  }
  readonly isRunning: boolean
}

export interface EventStoreCheckable {
  getAllStreamNames(): string[]
}

export interface PluginRuntimeCheckable {
  getAll(): Array<{
    id: string
    status: string
    healthStatus?: string
    failureCount?: number
  }>
}

export interface AtcHealthServiceOptions {
  db: DbCheckable
  redis: RedisCheckable
  eventBus: EventBusCheckable
  taskRuntime: TaskRuntimeCheckable
  eventStore: EventStoreCheckable
  pluginRuntime: PluginRuntimeCheckable
  /** Per-check timeout in ms. Default: 4000 */
  checkTimeoutMs?: number
}

const CRITICAL_SUBSYSTEMS = new Set(['db', 'redis'])

function aggregateStatus(subsystems: Record<string, AtcSubsystemHealth>): AtcRuntimeHealthStatus {
  const statuses = Object.values(subsystems).map((s) => s.status)
  const criticalKeys = Object.entries(subsystems)
    .filter(([k]) => CRITICAL_SUBSYSTEMS.has(k))
    .map(([, v]) => v.status)

  if (criticalKeys.some((s) => s === 'failed')) return 'failed'
  if (statuses.some((s) => s === 'failed')) return 'degraded'
  if (statuses.some((s) => s === 'degraded')) return 'degraded'
  return 'healthy'
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Check timed out after ${ms}ms`)), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e: unknown) => { clearTimeout(timer); reject(e) },
    )
  })
}

export class AtcHealthService {
  private readonly _opts: Required<AtcHealthServiceOptions>

  constructor(opts: AtcHealthServiceOptions) {
    this._opts = {
      checkTimeoutMs: 4_000,
      ...opts,
    }
  }

  async checkDb(): Promise<AtcSubsystemHealth> {
    const start = Date.now()
    const lastCheckedAt = new Date().toISOString()
    try {
      await withTimeout(
        (async () => {
          const conn = await this._opts.db.getConnection()
          await conn.ping()
          conn.release()
        })(),
        this._opts.checkTimeoutMs,
      )
      return { status: 'healthy', latencyMs: Date.now() - start, lastCheckedAt }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { status: 'failed', latencyMs: Date.now() - start, lastCheckedAt, message: msg }
    }
  }

  async checkRedis(): Promise<AtcSubsystemHealth> {
    const start = Date.now()
    const lastCheckedAt = new Date().toISOString()
    try {
      const pong = await withTimeout(this._opts.redis.ping(), this._opts.checkTimeoutMs)
      const ok = pong === 'PONG' || pong.toUpperCase() === 'PONG'
      return {
        status: ok ? 'healthy' : 'degraded',
        latencyMs: Date.now() - start,
        lastCheckedAt,
        ...(!ok ? { message: `Unexpected PING response: ${pong}` } : {}),
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { status: 'failed', latencyMs: Date.now() - start, lastCheckedAt, message: msg }
    }
  }

  async checkEventBus(): Promise<AtcSubsystemHealth> {
    const start = Date.now()
    const lastCheckedAt = new Date().toISOString()
    try {
      const metrics = this._opts.eventBus.getMetrics()
      const failRate =
        metrics.emittedTotal > 0
          ? metrics.failedTotal / metrics.emittedTotal
          : 0
      const status: AtcRuntimeHealthStatus = failRate > 0.1 ? 'degraded' : 'healthy'
      return {
        status,
        latencyMs: Date.now() - start,
        lastCheckedAt,
        metadata: {
          emittedTotal: metrics.emittedTotal,
          handledTotal: metrics.handledTotal,
          failedTotal: metrics.failedTotal,
          activeSubscribers: metrics.activeSubscribers,
        },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { status: 'degraded', latencyMs: Date.now() - start, lastCheckedAt, message: msg }
    }
  }

  async checkTaskRuntime(): Promise<AtcSubsystemHealth> {
    const start = Date.now()
    const lastCheckedAt = new Date().toISOString()
    try {
      const runtime = this._opts.taskRuntime
      const metrics = runtime.getMetrics()
      const status: AtcRuntimeHealthStatus = runtime.isRunning ? 'healthy' : 'degraded'
      return {
        status,
        latencyMs: Date.now() - start,
        lastCheckedAt,
        ...(!runtime.isRunning ? { message: 'Task scheduler is not running' } : {}),
        metadata: {
          isRunning: runtime.isRunning,
          activeWorkers: metrics.activeWorkers,
          queuedTotal: metrics.queuedTotal,
          failedTotal: metrics.failedTotal,
        },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { status: 'degraded', latencyMs: Date.now() - start, lastCheckedAt, message: msg }
    }
  }

  async checkEventStore(): Promise<AtcSubsystemHealth> {
    const start = Date.now()
    const lastCheckedAt = new Date().toISOString()
    try {
      const streamNames = this._opts.eventStore.getAllStreamNames()
      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
        lastCheckedAt,
        metadata: { streamCount: streamNames.length },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { status: 'degraded', latencyMs: Date.now() - start, lastCheckedAt, message: msg }
    }
  }

  async checkPluginRuntime(): Promise<AtcSubsystemHealth> {
    const start = Date.now()
    const lastCheckedAt = new Date().toISOString()
    try {
      const plugins = this._opts.pluginRuntime.getAll()
      const failed = plugins.filter(
        (p) => p.status === 'failed' || p.healthStatus === 'failed',
      ).length
      const degraded = plugins.filter(
        (p) => p.status === 'degraded' || p.healthStatus === 'degraded',
      ).length
      const status: AtcRuntimeHealthStatus =
        failed > 0 ? 'degraded' : degraded > 0 ? 'degraded' : 'healthy'
      return {
        status,
        latencyMs: Date.now() - start,
        lastCheckedAt,
        metadata: { total: plugins.length, failed, degraded },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { status: 'degraded', latencyMs: Date.now() - start, lastCheckedAt, message: msg }
    }
  }

  async getSnapshot(): Promise<AtcRuntimeHealthSnapshot> {
    const checkedAt = new Date().toISOString()

    // All checks run concurrently; a failed check does not block the others
    const [db, redis, eventBus, taskRuntime, eventStore, pluginRuntime] =
      await Promise.all([
        this.checkDb().catch((e: unknown) => this._fallback(e)),
        this.checkRedis().catch((e: unknown) => this._fallback(e)),
        this.checkEventBus().catch((e: unknown) => this._fallback(e)),
        this.checkTaskRuntime().catch((e: unknown) => this._fallback(e)),
        this.checkEventStore().catch((e: unknown) => this._fallback(e)),
        this.checkPluginRuntime().catch((e: unknown) => this._fallback(e)),
      ])

    const subsystems = { db, redis, eventBus, taskRuntime, eventStore, pluginRuntime }
    const apiSubsystem: AtcSubsystemHealth = {
      status: 'healthy',
      latencyMs: 0,
      lastCheckedAt: checkedAt,
    }

    const allSubsystems = { api: apiSubsystem, ...subsystems }
    const status = aggregateStatus(allSubsystems)

    return { status, subsystems: allSubsystems, checkedAt }
  }

  private _fallback(err: unknown): AtcSubsystemHealth {
    return {
      status: 'failed',
      latencyMs: 0,
      lastCheckedAt: new Date().toISOString(),
      message: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
