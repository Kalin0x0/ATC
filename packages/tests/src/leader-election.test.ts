import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AtcSchedulerLeaderElection } from '@atc/task-runtime'
import type { LeaderRedisClient } from '@atc/task-runtime'

// In-memory Redis mock simulating NX SET, Lua check-and-expire, GET, DEL
function makeRedis(opts: { startWithLeader?: string } = {}): LeaderRedisClient & { _store: Map<string, string> } {
  const _store = new Map<string, string>()
  if (opts.startWithLeader) _store.set('atc:runtime:scheduler:leader', opts.startWithLeader)

  return {
    _store,
    async set(key, value, _exMode, _ttl, nxMode) {
      if (nxMode === 'NX' && _store.has(key)) return null
      _store.set(key, value)
      return 'OK'
    },
    async eval(_script, _numkeys, key, owner) {
      // Simulate RENEW_LEADERSHIP_SCRIPT: check owner, extend TTL
      const current = _store.get(key)
      if (current !== owner) return 0
      // TTL extension is a no-op in memory; just confirm still owned
      return 1
    },
    async get(key) {
      return _store.get(key) ?? null
    },
    async del(key) {
      return _store.delete(key) ? 1 : 0
    },
  }
}

describe('AtcSchedulerLeaderElection — tryAcquire', () => {
  it('acquires leadership when key is free', async () => {
    const redis = makeRedis()
    const el = new AtcSchedulerLeaderElection(redis, 'node-1')
    const ok = await el.tryAcquire()
    expect(ok).toBe(true)
    expect(el.isLeader).toBe(true)
  })

  it('fails when another instance holds leadership', async () => {
    const redis = makeRedis({ startWithLeader: 'node-other' })
    const el = new AtcSchedulerLeaderElection(redis, 'node-1')
    const ok = await el.tryAcquire()
    expect(ok).toBe(false)
    expect(el.isLeader).toBe(false)
  })

  it('calls onBecomeLeader when leadership is acquired', async () => {
    const redis = makeRedis()
    const onBecomeLeader = vi.fn()
    const el = new AtcSchedulerLeaderElection(redis, 'node-1', { onBecomeLeader })
    await el.tryAcquire()
    expect(onBecomeLeader).toHaveBeenCalledOnce()
  })

  it('does not call onBecomeLeader when already leader', async () => {
    const redis = makeRedis()
    const onBecomeLeader = vi.fn()
    const el = new AtcSchedulerLeaderElection(redis, 'node-1', { onBecomeLeader })
    await el.tryAcquire()
    // Force a second acquire (key now set by us — NX fails, but simulate by clearing)
    redis._store.delete('atc:runtime:scheduler:leader')
    await el.tryAcquire() // already isLeader → callback should not fire again
    expect(onBecomeLeader).toHaveBeenCalledTimes(1)
  })

  it('is fail-open — assumes leadership when Redis is unavailable', async () => {
    const redis = makeRedis()
    vi.spyOn(redis, 'set').mockRejectedValue(new Error('ECONNREFUSED'))
    const onBecomeLeader = vi.fn()
    const el = new AtcSchedulerLeaderElection(redis, 'node-1', { onBecomeLeader })
    const ok = await el.tryAcquire()
    expect(ok).toBe(true)
    expect(el.isLeader).toBe(true)
    expect(onBecomeLeader).toHaveBeenCalledOnce()
  })

  it('returns false after stop()', async () => {
    const redis = makeRedis()
    const el = new AtcSchedulerLeaderElection(redis, 'node-1')
    await el.stop()
    const ok = await el.tryAcquire()
    expect(ok).toBe(false)
  })
})

describe('AtcSchedulerLeaderElection — renew', () => {
  it('returns true when we still own the key', async () => {
    const redis = makeRedis()
    const el = new AtcSchedulerLeaderElection(redis, 'node-1')
    await el.tryAcquire()
    const ok = await el.renew()
    expect(ok).toBe(true)
  })

  it('returns false and steps down when key was taken by another instance', async () => {
    const redis = makeRedis()
    const onLoseLeader = vi.fn()
    const el = new AtcSchedulerLeaderElection(redis, 'node-1', { onLoseLeader })
    await el.tryAcquire()
    // Simulate another instance taking the key
    redis._store.set('atc:runtime:scheduler:leader', 'node-other')
    const ok = await el.renew()
    expect(ok).toBe(false)
    expect(el.isLeader).toBe(false)
    expect(onLoseLeader).toHaveBeenCalledOnce()
  })

  it('returns false when not leader', async () => {
    const redis = makeRedis()
    const el = new AtcSchedulerLeaderElection(redis, 'node-1')
    const ok = await el.renew()
    expect(ok).toBe(false)
  })

  it('is fail-open — returns true on Redis error during renewal', async () => {
    const redis = makeRedis()
    const el = new AtcSchedulerLeaderElection(redis, 'node-1')
    await el.tryAcquire()
    vi.spyOn(redis, 'eval').mockRejectedValue(new Error('timeout'))
    const ok = await el.renew()
    expect(ok).toBe(true) // keep running even with Redis down
  })
})

describe('AtcSchedulerLeaderElection — release', () => {
  it('deletes the key and calls onLoseLeader', async () => {
    const redis = makeRedis()
    const onLoseLeader = vi.fn()
    const el = new AtcSchedulerLeaderElection(redis, 'node-1', { onLoseLeader })
    await el.tryAcquire()
    await el.release()
    expect(el.isLeader).toBe(false)
    expect(redis._store.has('atc:runtime:scheduler:leader')).toBe(false)
    expect(onLoseLeader).toHaveBeenCalledOnce()
  })

  it('is a no-op when not leader', async () => {
    const redis = makeRedis()
    const del = vi.spyOn(redis, 'del')
    const el = new AtcSchedulerLeaderElection(redis, 'node-1')
    await el.release()
    expect(del).not.toHaveBeenCalled()
  })
})

describe('AtcSchedulerLeaderElection — getLeader', () => {
  it('returns the current leader instanceId', async () => {
    const redis = makeRedis({ startWithLeader: 'node-x' })
    const el = new AtcSchedulerLeaderElection(redis, 'node-1')
    expect(await el.getLeader()).toBe('node-x')
  })

  it('returns null when no leader', async () => {
    const redis = makeRedis()
    const el = new AtcSchedulerLeaderElection(redis, 'node-1')
    expect(await el.getLeader()).toBeNull()
  })

  it('returns null on Redis error', async () => {
    const redis = makeRedis()
    vi.spyOn(redis, 'get').mockRejectedValue(new Error('io'))
    const el = new AtcSchedulerLeaderElection(redis, 'node-1')
    expect(await el.getLeader()).toBeNull()
  })
})

describe('AtcSchedulerLeaderElection — startRenewLoop', () => {
  it('repeatedly renews while leader', async () => {
    vi.useFakeTimers()
    const redis = makeRedis()
    const el = new AtcSchedulerLeaderElection(redis, 'node-1', { ttlMs: 3000 })
    await el.tryAcquire()
    const renew = vi.spyOn(el, 'renew').mockResolvedValue(true)
    el.startRenewLoop()
    vi.advanceTimersByTime(4000) // 4s, interval=1000ms → ~4 calls
    expect(renew.mock.calls.length).toBeGreaterThanOrEqual(3)
    el.stopRenewLoop()
    vi.useRealTimers()
  })

  it('attempts to acquire when not leader', async () => {
    vi.useFakeTimers()
    const redis = makeRedis({ startWithLeader: 'node-other' })
    const el = new AtcSchedulerLeaderElection(redis, 'node-1', { ttlMs: 3000 })
    const acquire = vi.spyOn(el, 'tryAcquire').mockResolvedValue(false)
    el.startRenewLoop()
    vi.advanceTimersByTime(2500)
    expect(acquire.mock.calls.length).toBeGreaterThanOrEqual(2)
    el.stopRenewLoop()
    vi.useRealTimers()
  })

  it('is idempotent — calling startRenewLoop twice does not double-fire', async () => {
    vi.useFakeTimers()
    const redis = makeRedis()
    const el = new AtcSchedulerLeaderElection(redis, 'node-1', { ttlMs: 3000 })
    await el.tryAcquire()
    const renew = vi.spyOn(el, 'renew').mockResolvedValue(true)
    el.startRenewLoop()
    el.startRenewLoop() // second call should be no-op
    vi.advanceTimersByTime(2000)
    el.stopRenewLoop()
    // Only one interval running → ≤ 2 calls in 2000ms at 1000ms interval
    expect(renew.mock.calls.length).toBeLessThanOrEqual(2)
    vi.useRealTimers()
  })

  it('stop() stops the renewal loop and releases leadership', async () => {
    const redis = makeRedis()
    const el = new AtcSchedulerLeaderElection(redis, 'node-1')
    await el.tryAcquire()
    await el.stop()
    expect(el.isLeader).toBe(false)
  })
})
