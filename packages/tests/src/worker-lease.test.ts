import { describe, it, expect, vi } from 'vitest'
import { AtcWorkerLeaseManager } from '@atc/task-runtime'
import type { LeaseRedisClient } from '@atc/task-runtime'

// In-memory Redis mock that faithfully simulates NX SET, Lua owner-check, and GET
function makeRedis(): LeaseRedisClient & { _store: Map<string, string> } {
  const _store = new Map<string, string>()

  return {
    _store,
    async set(key, value, _exMode, _ttl, nxMode) {
      if (nxMode === 'NX' && _store.has(key)) return null
      _store.set(key, value)
      return 'OK'
    },
    async eval(_script, _numkeys, key, owner, _ttl) {
      // Both Lua scripts check owner then act — we simulate:
      // RENEW: check-and-expire → return 1 if owner matches
      // RELEASE: check-and-del → return 1 if owner matches
      const current = _store.get(key)
      if (current !== owner) return 0
      // For release script, delete the key (we detect by checking ttl arg)
      if (_ttl === '0') {
        _store.delete(key)
      }
      // For renew script, keep key (TTL extension is a no-op in memory)
      return 1
    },
    async get(key) {
      return _store.get(key) ?? null
    },
    async setex(key, _seconds, value) {
      _store.set(key, value)
      return 'OK'
    },
    async del(key) {
      return _store.delete(key) ? 1 : 0
    },
  }
}

describe('AtcWorkerLeaseManager — acquireLease', () => {
  it('returns true and stores the owner when lease is free', async () => {
    const redis = makeRedis()
    const mgr = new AtcWorkerLeaseManager(redis)
    const ok = await mgr.acquireLease('task-1', 'worker-a')
    expect(ok).toBe(true)
    expect(redis._store.get('atc:tasks:lease:task-1')).toBe('worker-a')
  })

  it('returns false when another worker already holds the lease', async () => {
    const redis = makeRedis()
    const mgr = new AtcWorkerLeaseManager(redis)
    await mgr.acquireLease('task-1', 'worker-a')
    const ok = await mgr.acquireLease('task-1', 'worker-b')
    expect(ok).toBe(false)
  })

  it('is idempotent — same worker acquiring again returns false (NX prevents re-set)', async () => {
    const redis = makeRedis()
    const mgr = new AtcWorkerLeaseManager(redis)
    await mgr.acquireLease('task-1', 'worker-a')
    const ok = await mgr.acquireLease('task-1', 'worker-a')
    expect(ok).toBe(false)
  })

  it('is fail-open — returns true on Redis error (degrades to single-instance)', async () => {
    const redis = makeRedis()
    vi.spyOn(redis, 'set').mockRejectedValue(new Error('ECONNREFUSED'))
    const mgr = new AtcWorkerLeaseManager(redis)
    const ok = await mgr.acquireLease('task-x', 'worker-a')
    expect(ok).toBe(true)
  })
})

describe('AtcWorkerLeaseManager — renewLease', () => {
  it('returns true when the caller is the owner', async () => {
    const redis = makeRedis()
    const mgr = new AtcWorkerLeaseManager(redis)
    await mgr.acquireLease('task-1', 'worker-a')
    const ok = await mgr.renewLease('task-1', 'worker-a')
    expect(ok).toBe(true)
  })

  it('returns false when the caller is NOT the owner', async () => {
    const redis = makeRedis()
    const mgr = new AtcWorkerLeaseManager(redis)
    await mgr.acquireLease('task-1', 'worker-a')
    const ok = await mgr.renewLease('task-1', 'worker-b')
    expect(ok).toBe(false)
  })

  it('returns false when lease does not exist', async () => {
    const redis = makeRedis()
    const mgr = new AtcWorkerLeaseManager(redis)
    const ok = await mgr.renewLease('nonexistent', 'worker-a')
    expect(ok).toBe(false)
  })

  it('returns false on Redis error (fail-closed for renewal)', async () => {
    const redis = makeRedis()
    vi.spyOn(redis, 'eval').mockRejectedValue(new Error('timeout'))
    const mgr = new AtcWorkerLeaseManager(redis)
    const ok = await mgr.renewLease('task-1', 'worker-a')
    expect(ok).toBe(false)
  })
})

describe('AtcWorkerLeaseManager — releaseLease', () => {
  it('releases the lease when called by the owner', async () => {
    const redis = makeRedis()
    const mgr = new AtcWorkerLeaseManager(redis)
    await mgr.acquireLease('task-1', 'worker-a')
    const ok = await mgr.releaseLease('task-1', 'worker-a')
    expect(ok).toBe(true)
    expect(redis._store.has('atc:tasks:lease:task-1')).toBe(false)
  })

  it('rejects release by a non-owner', async () => {
    const redis = makeRedis()
    const mgr = new AtcWorkerLeaseManager(redis)
    await mgr.acquireLease('task-1', 'worker-a')
    const ok = await mgr.releaseLease('task-1', 'worker-b')
    expect(ok).toBe(false)
    expect(redis._store.get('atc:tasks:lease:task-1')).toBe('worker-a') // key still present
  })

  it('returns false for a key that does not exist', async () => {
    const redis = makeRedis()
    const mgr = new AtcWorkerLeaseManager(redis)
    const ok = await mgr.releaseLease('nonexistent', 'worker-a')
    expect(ok).toBe(false)
  })
})

describe('AtcWorkerLeaseManager — getOwner', () => {
  it('returns the current owner', async () => {
    const redis = makeRedis()
    const mgr = new AtcWorkerLeaseManager(redis)
    await mgr.acquireLease('task-1', 'worker-a')
    expect(await mgr.getOwner('task-1')).toBe('worker-a')
  })

  it('returns null when no lease exists', async () => {
    const redis = makeRedis()
    const mgr = new AtcWorkerLeaseManager(redis)
    expect(await mgr.getOwner('task-none')).toBeNull()
  })

  it('returns null on Redis error', async () => {
    const redis = makeRedis()
    vi.spyOn(redis, 'get').mockRejectedValue(new Error('io error'))
    const mgr = new AtcWorkerLeaseManager(redis)
    expect(await mgr.getOwner('task-1')).toBeNull()
  })
})

describe('AtcWorkerLeaseManager — registerWorker / deregisterWorker', () => {
  it('stores worker registration', async () => {
    const redis = makeRedis()
    const mgr = new AtcWorkerLeaseManager(redis)
    await mgr.registerWorker('worker-a', 'instance-1')
    expect(redis._store.get('atc:tasks:worker:worker-a')).toBe('instance-1')
  })

  it('removes worker registration on deregister', async () => {
    const redis = makeRedis()
    const mgr = new AtcWorkerLeaseManager(redis)
    await mgr.registerWorker('worker-a', 'instance-1')
    await mgr.deregisterWorker('worker-a')
    expect(redis._store.has('atc:tasks:worker:worker-a')).toBe(false)
  })

  it('is fail-open for registerWorker', async () => {
    const redis = makeRedis()
    vi.spyOn(redis, 'setex').mockRejectedValue(new Error('Redis down'))
    const mgr = new AtcWorkerLeaseManager(redis)
    await expect(mgr.registerWorker('worker-a', 'instance-1')).resolves.toBeUndefined()
  })
})
