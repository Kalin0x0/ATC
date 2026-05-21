import { describe, it, expect, beforeEach } from 'vitest'
import { AtcPluginHealthMonitor } from '@atc/plugin-registry'

describe('AtcPluginHealthMonitor — initial state', () => {
  it('returns healthy state for fresh plugin', () => {
    const mon = new AtcPluginHealthMonitor()
    mon.init('p1')
    const h = mon.getHealth('p1')
    expect(h.status).toBe('healthy')
    expect(h.failureCount).toBe(0)
    expect(h.restartCount).toBe(0)
    expect(h.lastHeartbeat).toBeNull()
  })

  it('returns healthy defaults for unknown plugin', () => {
    const mon = new AtcPluginHealthMonitor()
    const h = mon.getHealth('unknown')
    expect(h.status).toBe('healthy')
    expect(h.failureCount).toBe(0)
  })
})

describe('AtcPluginHealthMonitor — recordFailure', () => {
  it('increments failureCount on each failure', () => {
    const mon = new AtcPluginHealthMonitor({ maxFailures: 5 })
    mon.init('p1')
    mon.recordFailure('p1')
    mon.recordFailure('p1')
    expect(mon.getHealth('p1').failureCount).toBe(2)
  })

  it('transitions to degraded at degrade threshold', () => {
    const mon = new AtcPluginHealthMonitor({ maxFailures: 6, degradeThreshold: 3 })
    mon.init('p1')
    mon.recordFailure('p1')
    mon.recordFailure('p1')
    mon.recordFailure('p1')
    expect(mon.getHealth('p1').status).toBe('degraded')
  })

  it('transitions to failed and returns shouldDisable at maxFailures', () => {
    const mon = new AtcPluginHealthMonitor({ maxFailures: 3 })
    mon.init('p1')
    mon.recordFailure('p1')
    mon.recordFailure('p1')
    const result = mon.recordFailure('p1')
    expect(result.shouldDisable).toBe(true)
    expect(mon.getHealth('p1').status).toBe('failed')
  })

  it('records lastError from failure', () => {
    const mon = new AtcPluginHealthMonitor()
    mon.init('p1')
    mon.recordFailure('p1', 'something went wrong')
    expect(mon.getHealth('p1').lastError).toBe('something went wrong')
  })

  it('returns shouldDisable: false below threshold', () => {
    const mon = new AtcPluginHealthMonitor({ maxFailures: 5 })
    mon.init('p1')
    const result = mon.recordFailure('p1')
    expect(result.shouldDisable).toBe(false)
  })
})

describe('AtcPluginHealthMonitor — recordSuccess', () => {
  it('updates lastHeartbeat on success', () => {
    const mon = new AtcPluginHealthMonitor()
    mon.init('p1')
    mon.recordSuccess('p1')
    expect(mon.getHealth('p1').lastHeartbeat).not.toBeNull()
  })
})

describe('AtcPluginHealthMonitor — heartbeat', () => {
  it('updates lastHeartbeat timestamp', () => {
    const mon = new AtcPluginHealthMonitor()
    mon.init('p1')
    mon.heartbeat('p1')
    expect(mon.getHealth('p1').lastHeartbeat).not.toBeNull()
  })
})

describe('AtcPluginHealthMonitor — incrementRestartCount', () => {
  it('increments restartCount', () => {
    const mon = new AtcPluginHealthMonitor()
    mon.init('p1')
    mon.incrementRestartCount('p1')
    mon.incrementRestartCount('p1')
    expect(mon.getHealth('p1').restartCount).toBe(2)
  })
})

describe('AtcPluginHealthMonitor — reset', () => {
  it('resets all health fields to defaults', () => {
    const mon = new AtcPluginHealthMonitor({ maxFailures: 2 })
    mon.init('p1')
    mon.recordFailure('p1')
    mon.recordFailure('p1')
    mon.reset('p1')
    const h = mon.getHealth('p1')
    expect(h.status).toBe('healthy')
    expect(h.failureCount).toBe(0)
    expect(h.restartCount).toBe(0)
  })
})

describe('AtcPluginHealthMonitor — remove', () => {
  it('removes plugin from monitor', () => {
    const mon = new AtcPluginHealthMonitor()
    mon.init('p1')
    mon.recordFailure('p1', 'error')
    mon.remove('p1')
    // After remove, should return fresh defaults
    const h = mon.getHealth('p1')
    expect(h.failureCount).toBe(0)
  })
})

describe('AtcPluginHealthMonitor — getAll', () => {
  it('returns copies of all records', () => {
    const mon = new AtcPluginHealthMonitor()
    mon.init('p1')
    mon.init('p2')
    const all = mon.getAll()
    expect(all.size).toBe(2)
    // Mutations do not affect internal state
    all.get('p1')!.failureCount = 999
    expect(mon.getHealth('p1').failureCount).toBe(0)
  })
})
