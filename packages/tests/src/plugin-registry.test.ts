import { describe, it, expect, beforeEach } from 'vitest'
import {
  AtcPluginRegistry,
  PluginDuplicateError,
  PluginNotFoundError,
  PluginInvalidStatusError,
} from '@atc/plugin-registry'

// ── register ──────────────────────────────────────────────────────────────────

describe('AtcPluginRegistry — register', () => {
  it('registers a valid manifest', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'atc-food', version: '1.0.0' })
    expect(reg.get('atc-food')).toBeDefined()
  })

  it('sets initial status to registered', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'atc-food', version: '1.0.0' })
    expect(reg.get('atc-food')!.status).toBe('registered')
  })

  it('throws PluginDuplicateError on duplicate id', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'atc-food', version: '1.0.0' })
    expect(() => reg.register({ id: 'atc-food', version: '2.0.0' })).toThrow(PluginDuplicateError)
  })

  it('rejects invalid id (special characters)', () => {
    const reg = new AtcPluginRegistry()
    expect(() => reg.register({ id: 'My Plugin!', version: '1.0.0' })).toThrow()
  })

  it('rejects invalid semver', () => {
    const reg = new AtcPluginRegistry()
    expect(() => reg.register({ id: 'atc-food', version: 'not-a-version' })).toThrow()
  })

  it('stores capabilities and dependencies', () => {
    const reg = new AtcPluginRegistry()
    reg.register({
      id: 'atc-food',
      version: '1.0.0',
      capabilities: ['vitals.write'],
      dependencies: [{ id: 'atc-vitals', version: '^1.0.0' }],
    })
    const record = reg.get('atc-food')!
    expect(record.capabilities).toContain('vitals.write')
    expect(record.dependencies[0]!.id).toBe('atc-vitals')
  })

  it('loadedAt is null for newly registered plugin', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'atc-food', version: '1.0.0' })
    expect(reg.get('atc-food')!.loadedAt).toBeNull()
  })
})

// ── unregister ────────────────────────────────────────────────────────────────

describe('AtcPluginRegistry — unregister', () => {
  it('removes a registered plugin', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'atc-food', version: '1.0.0' })
    reg.unregister('atc-food')
    expect(reg.get('atc-food')).toBeUndefined()
  })

  it('throws PluginNotFoundError for unknown id', () => {
    const reg = new AtcPluginRegistry()
    expect(() => reg.unregister('nonexistent')).toThrow(PluginNotFoundError)
  })

  it('throws PluginInvalidStatusError when plugin is active', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'atc-food', version: '1.0.0' })
    reg.setStatus('atc-food', 'active')
    expect(() => reg.unregister('atc-food')).toThrow(PluginInvalidStatusError)
  })
})

// ── enable / disable ──────────────────────────────────────────────────────────

describe('AtcPluginRegistry — enable / disable', () => {
  it('enable sets status to active and records loadedAt', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'atc-food', version: '1.0.0' })
    reg.enable('atc-food')
    const r = reg.get('atc-food')!
    expect(r.status).toBe('active')
    expect(r.loadedAt).not.toBeNull()
  })

  it('disable sets status to disabled', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'atc-food', version: '1.0.0' })
    reg.enable('atc-food')
    reg.disable('atc-food', 'manual disable')
    const r = reg.get('atc-food')!
    expect(r.status).toBe('disabled')
    expect(r.lastError).toBe('manual disable')
  })
})

// ── getAll ────────────────────────────────────────────────────────────────────

describe('AtcPluginRegistry — getAll', () => {
  it('returns all registered plugins', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'atc-a', version: '1.0.0' })
    reg.register({ id: 'atc-b', version: '1.0.0' })
    expect(reg.getAll()).toHaveLength(2)
  })

  it('returns empty array for fresh registry', () => {
    expect(new AtcPluginRegistry().getAll()).toHaveLength(0)
  })
})

// ── immutability ──────────────────────────────────────────────────────────────

describe('AtcPluginRegistry — immutable records', () => {
  it('mutating get() result does not affect internal state', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'atc-food', version: '1.0.0' })
    const copy = reg.get('atc-food')!
    copy.status = 'active'
    expect(reg.get('atc-food')!.status).toBe('registered')
  })

  it('mutating getAll() result does not affect internal state', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'atc-food', version: '1.0.0' })
    const all = reg.getAll()
    all[0]!.status = 'failed'
    expect(reg.get('atc-food')!.status).toBe('registered')
  })

  it('mutating capabilities array from get() does not affect internal state', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'atc-food', version: '1.0.0', capabilities: ['vitals.read'] })
    const r = reg.get('atc-food')!
    r.capabilities.push('admin.write' as never)
    expect(reg.get('atc-food')!.capabilities).toHaveLength(1)
  })
})

// ── load order ────────────────────────────────────────────────────────────────

describe('AtcPluginRegistry — getLoadOrder', () => {
  it('returns correct topological order', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'atc-food', version: '1.0.0', dependencies: [{ id: 'atc-vitals', version: '^1.0.0' }] })
    reg.register({ id: 'atc-vitals', version: '1.2.0' })
    const order = reg.getLoadOrder()
    expect(order.indexOf('atc-vitals')).toBeLessThan(order.indexOf('atc-food'))
  })
})

// ── metrics ───────────────────────────────────────────────────────────────────

describe('AtcPluginRegistry — metrics', () => {
  it('eventsHandled starts at 0', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'atc-food', version: '1.0.0' })
    expect(reg.getEventsHandled('atc-food')).toBe(0)
  })

  it('incrementEventsHandled tracks count and timing', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'atc-food', version: '1.0.0' })
    reg.incrementEventsHandled('atc-food', 10)
    reg.incrementEventsHandled('atc-food', 20)
    expect(reg.getEventsHandled('atc-food')).toBe(2)
    expect(reg.getAvgExecutionMs('atc-food')).toBe(15)
  })

  it('resetMetrics resets eventsHandled and lifecycleMetrics', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'atc-food', version: '1.0.0' })
    reg.incrementEventsHandled('atc-food', 5)
    reg.resetMetrics('atc-food')
    expect(reg.getEventsHandled('atc-food')).toBe(0)
    expect(reg.getAvgExecutionMs('atc-food')).toBe(0)
  })
})
