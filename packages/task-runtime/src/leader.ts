// Distributed scheduler leader election.
// Uses Redis SET NX EX for atomic lease acquisition. Only the leader
// runs scheduler ticks, preventing duplicate task processing across instances.
// Failover is automatic: if the leader crashes, its key expires and another
// instance acquires leadership on its next tryAcquire() call.

const LEADER_KEY = 'atc:runtime:scheduler:leader'

// Lua script: renew leadership only if we still own the key (atomic check-and-extend)
const RENEW_LEADERSHIP_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('expire', KEYS[1], ARGV[2])
else
  return 0
end
`

// Duck-typed Redis interface satisfied by ioredis
export interface LeaderRedisClient {
  set(key: string, value: string, exMode: 'EX', ttl: number, nxMode: 'NX'): Promise<'OK' | null>
  eval(script: string, numkeys: number, key: string, owner: string, ttl: string): Promise<number>
  get(key: string): Promise<string | null>
  del(key: string): Promise<number>
}

export interface AtcSchedulerLeaderElectionOptions {
  /** Lease TTL in ms. Default: 15_000 (15s) */
  ttlMs?: number
  /** How often to renew leadership in ms. Default: ttlMs / 3 */
  renewIntervalMs?: number
  /** Called when this instance gains leadership */
  onBecomeLeader?: () => void
  /** Called when this instance loses leadership */
  onLoseLeader?: () => void
}

export class AtcSchedulerLeaderElection {
  private readonly _ttlSeconds: number
  private readonly _renewIntervalMs: number
  private readonly _onBecomeLeader: (() => void) | undefined
  private readonly _onLoseLeader: (() => void) | undefined

  private _isLeader = false
  private _renewTimer: ReturnType<typeof setInterval> | null = null
  private _closed = false

  constructor(
    private readonly _redis: LeaderRedisClient,
    private readonly _instanceId: string,
    opts: AtcSchedulerLeaderElectionOptions = {},
  ) {
    const ttlMs = opts.ttlMs ?? 15_000
    this._ttlSeconds = Math.ceil(ttlMs / 1000)
    this._renewIntervalMs = opts.renewIntervalMs ?? Math.floor(ttlMs / 3)
    this._onBecomeLeader = opts.onBecomeLeader
    this._onLoseLeader = opts.onLoseLeader
  }

  get isLeader(): boolean {
    return this._isLeader
  }

  get instanceId(): string {
    return this._instanceId
  }

  /** Attempt to acquire leadership. Returns true if this instance is now leader. */
  async tryAcquire(): Promise<boolean> {
    if (this._closed) return false
    try {
      const result = await this._redis.set(
        LEADER_KEY,
        this._instanceId,
        'EX',
        this._ttlSeconds,
        'NX',
      )
      const acquired = result === 'OK'
      if (acquired && !this._isLeader) {
        this._isLeader = true
        this._onBecomeLeader?.()
      }
      return acquired
    } catch {
      // Fail-open: if Redis is unavailable, assume leadership to keep scheduler running
      if (!this._isLeader) {
        this._isLeader = true
        this._onBecomeLeader?.()
      }
      return true
    }
  }

  /** Renew our leadership lease. Returns false if we lost leadership. */
  async renew(): Promise<boolean> {
    if (this._closed || !this._isLeader) return false
    try {
      const result = await this._redis.eval(
        RENEW_LEADERSHIP_SCRIPT,
        1,
        LEADER_KEY,
        this._instanceId,
        String(this._ttlSeconds),
      )
      if (result !== 1) {
        // Lost leadership (key expired or taken by another instance)
        this._isLeader = false
        this._onLoseLeader?.()
        return false
      }
      return true
    } catch {
      // Fail-open: keep running even if Redis is unavailable during renewal
      return true
    }
  }

  /** Voluntarily release leadership (e.g., on graceful shutdown). */
  async release(): Promise<void> {
    if (!this._isLeader) return
    this._isLeader = false
    try {
      await this._redis.del(LEADER_KEY)
    } catch {
      // Fail-open
    }
    this._onLoseLeader?.()
  }

  /** Get the current leader's instanceId (null if no leader or Redis unavailable). */
  async getLeader(): Promise<string | null> {
    try {
      return await this._redis.get(LEADER_KEY)
    } catch {
      return null
    }
  }

  /** Start background renewal loop. Automatically steps down if leadership is lost. */
  startRenewLoop(): void {
    if (this._renewTimer !== null || this._closed) return
    this._renewTimer = setInterval(() => {
      if (this._isLeader) {
        void this.renew()
      } else {
        // Not leader: try to acquire in case the previous leader expired
        void this.tryAcquire()
      }
    }, this._renewIntervalMs)
  }

  stopRenewLoop(): void {
    if (this._renewTimer !== null) {
      clearInterval(this._renewTimer)
      this._renewTimer = null
    }
  }

  async stop(): Promise<void> {
    this._closed = true
    this.stopRenewLoop()
    await this.release()
  }
}
