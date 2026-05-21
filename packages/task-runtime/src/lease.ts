// Worker lease manager — prevents duplicate task execution across instances.
// Uses Redis SET NX EX for atomic lease acquisition and Lua scripts for
// atomic owner-checked renew/release operations.

const LEASE_PREFIX = 'atc:tasks:lease:'
const WORKER_KEY_PREFIX = 'atc:tasks:worker:'

// Lua script: renew lease only if current owner matches (atomic check-and-extend)
const RENEW_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('expire', KEYS[1], ARGV[2])
else
  return 0
end
`

// Lua script: release lease only if current owner matches (atomic check-and-delete)
const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`

// Duck-typed Redis interface satisfied by ioredis
export interface LeaseRedisClient {
  set(
    key: string,
    value: string,
    exMode: 'EX',
    ttl: number,
    nxMode: 'NX',
  ): Promise<'OK' | null>
  eval(script: string, numkeys: number, key: string, owner: string, ttl: string): Promise<number>
  get(key: string): Promise<string | null>
  setex(key: string, seconds: number, value: string): Promise<string>
  del(key: string): Promise<number>
}

export interface AtcWorkerLeaseManagerOptions {
  ttlMs?: number
}

export class AtcWorkerLeaseManager {
  private readonly _ttlSeconds: number

  constructor(
    private readonly _redis: LeaseRedisClient,
    opts: AtcWorkerLeaseManagerOptions = {},
  ) {
    this._ttlSeconds = Math.ceil((opts.ttlMs ?? 30_000) / 1000)
  }

  /** Attempt to acquire exclusive lease on a task. Returns true if acquired. */
  async acquireLease(taskId: string, workerId: string): Promise<boolean> {
    try {
      const result = await this._redis.set(
        `${LEASE_PREFIX}${taskId}`,
        workerId,
        'EX',
        this._ttlSeconds,
        'NX',
      )
      return result === 'OK'
    } catch {
      // Fail-open: if Redis is unavailable, allow execution to proceed
      // (degrades to single-instance behavior)
      return true
    }
  }

  /** Renew a lease we own. Returns true if still owner and renewed. */
  async renewLease(taskId: string, workerId: string): Promise<boolean> {
    try {
      const result = await this._redis.eval(
        RENEW_SCRIPT,
        1,
        `${LEASE_PREFIX}${taskId}`,
        workerId,
        String(this._ttlSeconds),
      )
      return result === 1
    } catch {
      return false
    }
  }

  /** Release a lease. Only removes if we are the current owner. */
  async releaseLease(taskId: string, workerId: string): Promise<boolean> {
    try {
      const result = await this._redis.eval(
        RELEASE_SCRIPT,
        1,
        `${LEASE_PREFIX}${taskId}`,
        workerId,
        '0',
      )
      return result === 1
    } catch {
      return false
    }
  }

  /** Get the current lease owner for a task (null if no lease). */
  async getOwner(taskId: string): Promise<string | null> {
    try {
      return await this._redis.get(`${LEASE_PREFIX}${taskId}`)
    } catch {
      return null
    }
  }

  /** Register a worker's presence in Redis (for orphan detection). */
  async registerWorker(workerId: string, instanceId: string): Promise<void> {
    try {
      await this._redis.setex(
        `${WORKER_KEY_PREFIX}${workerId}`,
        this._ttlSeconds * 2,
        instanceId,
      )
    } catch {
      // Fail-open
    }
  }

  /** Remove a worker's registration on clean shutdown. */
  async deregisterWorker(workerId: string): Promise<void> {
    try {
      await this._redis.del(`${WORKER_KEY_PREFIX}${workerId}`)
    } catch {
      // Fail-open
    }
  }
}
