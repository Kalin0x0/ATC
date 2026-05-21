import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AtcRuntimeNodeService } from '@atc/runtime-node'
import type { RuntimeNodeRedisClient } from '@atc/runtime-node'

function makeRedis(opts: {
  existsReturn?: number
  hgetallReturn?: Record<string, string> | null
} = {}): RuntimeNodeRedisClient & { _store: Record<string, string>; _ttls: Record<string, number> } {
  const _store: Record<string, string> = {}
  const _ttls: Record<string, number> = {}

  return {
    _store,
    _ttls,
    async hset(key, field, value) {
      _store[`${key}:${field}`] = value
      return 1
    },
    async hgetall() {
      return opts.hgetallReturn ?? null
    },
    async hdel(key, ...fields) {
      let deleted = 0
      for (const f of fields) {
        if (`${key}:${f}` in _store) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete _store[`${key}:${f}`]
          deleted++
        }
      }
      return deleted
    },
    async setex(key, seconds, value) {
      _store[key] = value
      _ttls[key] = seconds
      return 'OK'
    },
    async exists(key) {
      if (opts.existsReturn !== undefined) return opts.existsReturn
      return key in _store ? 1 : 0
    },
    async del(key) {
      if (key in _store) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete _store[key]
        return 1
      }
      return 0
    },
  }
}

describe('AtcRuntimeNodeService — register', () => {
  it('calls hset and setex on register()', async () => {
    const redis = makeRedis()
    const hset = vi.spyOn(redis, 'hset')
    const setex = vi.spyOn(redis, 'setex')
    const node = new AtcRuntimeNodeService(redis, { instanceId: 'node-1' })
    await node.register()
    expect(hset).toHaveBeenCalledOnce()
    expect(setex).toHaveBeenCalledOnce()
    expect(node.isRegistered).toBe(true)
  })

  it('stores the node record under the instance ID field', async () => {
    const redis = makeRedis()
    const node = new AtcRuntimeNodeService(redis, { instanceId: 'node-abc' })
    await node.register()
    const raw = redis._store['atc:runtime:nodes:node-abc']
    expect(raw).toBeDefined()
    const parsed = JSON.parse(raw!) as { instanceId: string }
    expect(parsed.instanceId).toBe('node-abc')
  })

  it('sets heartbeat TTL to 30 seconds', async () => {
    const redis = makeRedis()
    const node = new AtcRuntimeNodeService(redis, { instanceId: 'node-1' })
    await node.register()
    const ttl = redis._ttls['atc:runtime:heartbeat:node-1']
    expect(ttl).toBe(30)
  })

  it('is fail-open — does not throw if Redis errors', async () => {
    const redis = makeRedis()
    vi.spyOn(redis, 'hset').mockRejectedValue(new Error('ECONNREFUSED'))
    const node = new AtcRuntimeNodeService(redis, { instanceId: 'node-1' })
    await expect(node.register()).resolves.toBeUndefined()
    expect(node.isRegistered).toBe(false) // register failed silently
  })
})

describe('AtcRuntimeNodeService — heartbeat', () => {
  it('refreshes the heartbeat key TTL', async () => {
    const redis = makeRedis()
    const node = new AtcRuntimeNodeService(redis, { instanceId: 'node-1' })
    await node.register()
    const setex = vi.spyOn(redis, 'setex')
    await node.heartbeat()
    expect(setex).toHaveBeenLastCalledWith('atc:runtime:heartbeat:node-1', 30, 'alive')
  })

  it('is fail-open — does not throw if Redis errors during heartbeat', async () => {
    const redis = makeRedis()
    vi.spyOn(redis, 'setex').mockRejectedValue(new Error('timeout'))
    const node = new AtcRuntimeNodeService(redis, { instanceId: 'node-1' })
    await expect(node.heartbeat()).resolves.toBeUndefined()
  })
})

describe('AtcRuntimeNodeService — deregister', () => {
  it('removes the node from the registry', async () => {
    const redis = makeRedis()
    const hdel = vi.spyOn(redis, 'hdel')
    const del = vi.spyOn(redis, 'del')
    const node = new AtcRuntimeNodeService(redis, { instanceId: 'node-1' })
    await node.register()
    await node.deregister()
    expect(hdel).toHaveBeenCalledWith('atc:runtime:nodes', 'node-1')
    expect(del).toHaveBeenCalledWith('atc:runtime:heartbeat:node-1')
    expect(node.isRegistered).toBe(false)
  })
})

describe('AtcRuntimeNodeService — listNodes', () => {
  it('returns empty array when no nodes registered', async () => {
    const redis = makeRedis({ hgetallReturn: null })
    const node = new AtcRuntimeNodeService(redis)
    const nodes = await node.listNodes()
    expect(nodes).toEqual([])
  })

  it('marks nodes with live heartbeat as not stale', async () => {
    const record = {
      instanceId: 'node-x',
      hostname: 'host1',
      pid: 1234,
      startedAt: new Date().toISOString(),
      capabilities: ['tasks'],
      version: '22.0.0',
    }
    const redis = makeRedis({
      hgetallReturn: { 'node-x': JSON.stringify(record) },
      existsReturn: 1, // heartbeat key exists → not stale
    })
    const node = new AtcRuntimeNodeService(redis)
    const nodes = await node.listNodes()
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.isStale).toBe(false)
    expect(nodes[0]!.instanceId).toBe('node-x')
  })

  it('marks nodes with expired heartbeat as stale', async () => {
    const record = {
      instanceId: 'node-y',
      hostname: 'host2',
      pid: 9999,
      startedAt: new Date().toISOString(),
      capabilities: [],
      version: '22.0.0',
    }
    const redis = makeRedis({
      hgetallReturn: { 'node-y': JSON.stringify(record) },
      existsReturn: 0, // heartbeat key missing → stale
    })
    const node = new AtcRuntimeNodeService(redis)
    const nodes = await node.listNodes()
    expect(nodes[0]!.isStale).toBe(true)
    expect(nodes[0]!.lastHeartbeatAt).toBeNull()
  })

  it('skips entries with malformed JSON', async () => {
    const redis = makeRedis({ hgetallReturn: { 'bad-node': 'not-json' } })
    const node = new AtcRuntimeNodeService(redis)
    const nodes = await node.listNodes()
    expect(nodes).toHaveLength(0)
  })

  it('is fail-open — returns empty array on Redis error', async () => {
    const redis = makeRedis()
    vi.spyOn(redis, 'hgetall').mockRejectedValue(new Error('network'))
    const node = new AtcRuntimeNodeService(redis)
    const nodes = await node.listNodes()
    expect(nodes).toEqual([])
  })
})

describe('AtcRuntimeNodeService — getRecord', () => {
  it('returns a copy of the node record', () => {
    const redis = makeRedis()
    const node = new AtcRuntimeNodeService(redis, { instanceId: 'node-copy', capabilities: ['api'] })
    const rec = node.getRecord()
    expect(rec.instanceId).toBe('node-copy')
    expect(rec.capabilities).toContain('api')
  })
})

describe('AtcRuntimeNodeService — startHeartbeat / stopHeartbeat', () => {
  it('calls heartbeat on an interval and stops cleanly', async () => {
    vi.useFakeTimers()
    const redis = makeRedis()
    const node = new AtcRuntimeNodeService(redis, { instanceId: 'node-hb' })
    const hb = vi.spyOn(node, 'heartbeat').mockResolvedValue(undefined)
    node.startHeartbeat(1000)
    vi.advanceTimersByTime(3500)
    expect(hb).toHaveBeenCalledTimes(3)
    node.stopHeartbeat()
    vi.advanceTimersByTime(2000)
    expect(hb).toHaveBeenCalledTimes(3) // no more calls after stop
    vi.useRealTimers()
  })

  it('is idempotent — calling startHeartbeat twice does not double-fire', () => {
    vi.useFakeTimers()
    const redis = makeRedis()
    const node = new AtcRuntimeNodeService(redis, { instanceId: 'node-idem' })
    const hb = vi.spyOn(node, 'heartbeat').mockResolvedValue(undefined)
    node.startHeartbeat(1000)
    node.startHeartbeat(1000)
    vi.advanceTimersByTime(2500)
    expect(hb).toHaveBeenCalledTimes(2) // only one interval fires
    node.stopHeartbeat()
    vi.useRealTimers()
  })
})
