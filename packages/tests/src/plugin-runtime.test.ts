import { describe, it, expect, vi } from 'vitest'
import { AtcPluginPermissionGuard, AtcPluginRuntime, AtcPermissionDeniedError, ATC_CAPABILITIES, isValidCapability } from '@atc/plugin-runtime'
import type { AtcPluginCapability } from '@atc/plugin-runtime'

// ── guard: hasPermission ──────────────────────────────────────────────────────

describe('AtcPluginPermissionGuard — hasPermission', () => {
  it('returns true for a capability the plugin has', () => {
    const guard = new AtcPluginPermissionGuard(['inventory.read', 'vitals.write'])
    expect(guard.hasPermission('inventory.read')).toBe(true)
    expect(guard.hasPermission('vitals.write')).toBe(true)
  })

  it('returns false for a capability the plugin does not have', () => {
    const guard = new AtcPluginPermissionGuard(['inventory.read'])
    expect(guard.hasPermission('vitals.write')).toBe(false)
    expect(guard.hasPermission('admin.read')).toBe(false)
  })

  it('returns false for every capability when constructed with empty array (deny-by-default)', () => {
    const guard = new AtcPluginPermissionGuard([])
    for (const cap of ATC_CAPABILITIES) {
      expect(guard.hasPermission(cap)).toBe(false)
    }
  })
})

// ── guard: assertPermission ───────────────────────────────────────────────────

describe('AtcPluginPermissionGuard — assertPermission', () => {
  it('does not throw when the plugin has the required capability', () => {
    const guard = new AtcPluginPermissionGuard(['inventory.read'])
    expect(() => guard.assertPermission('plugin-id', 'inventory.read')).not.toThrow()
  })

  it('throws AtcPermissionDeniedError when the plugin lacks the capability', () => {
    const guard = new AtcPluginPermissionGuard([])
    expect(() => guard.assertPermission('my-plugin', 'vitals.write'))
      .toThrow(AtcPermissionDeniedError)
  })

  it('error message includes pluginId and capability', () => {
    const guard = new AtcPluginPermissionGuard([])
    try {
      guard.assertPermission('test-plugin', 'admin.write')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AtcPermissionDeniedError)
      const e = err as AtcPermissionDeniedError
      expect(e.pluginId).toBe('test-plugin')
      expect(e.capability).toBe('admin.write')
      expect(e.message).toContain('test-plugin')
      expect(e.message).toContain('admin.write')
    }
  })
})

// ── guard: assertAnyPermission ────────────────────────────────────────────────

describe('AtcPluginPermissionGuard — assertAnyPermission', () => {
  it('passes when plugin has at least one of the listed capabilities', () => {
    const guard = new AtcPluginPermissionGuard(['inventory.read'])
    expect(() => guard.assertAnyPermission('p', ['vitals.write', 'inventory.read'])).not.toThrow()
  })

  it('throws when plugin has none of the listed capabilities', () => {
    const guard = new AtcPluginPermissionGuard(['status.read'])
    expect(() => guard.assertAnyPermission('p', ['vitals.write', 'inventory.read']))
      .toThrow(AtcPermissionDeniedError)
  })
})

// ── guard: constructor validation ─────────────────────────────────────────────

describe('AtcPluginPermissionGuard — constructor validation', () => {
  it('rejects wildcard capability', () => {
    expect(() => new AtcPluginPermissionGuard(['*'])).toThrow("Wildcard '*'")
  })

  it('rejects unknown capability strings', () => {
    expect(() => new AtcPluginPermissionGuard(['combat.attack'])).toThrow('Unknown plugin capability')
  })

  it('deduplicates repeated capabilities', () => {
    const guard = new AtcPluginPermissionGuard(['inventory.read', 'inventory.read'])
    expect(guard.list()).toHaveLength(1)
  })
})

// ── isValidCapability ─────────────────────────────────────────────────────────

describe('isValidCapability', () => {
  it('returns true for all defined capabilities', () => {
    for (const cap of ATC_CAPABILITIES) {
      expect(isValidCapability(cap)).toBe(true)
    }
  })

  it('returns false for unknown strings', () => {
    expect(isValidCapability('combat.attack')).toBe(false)
    expect(isValidCapability('*')).toBe(false)
    expect(isValidCapability('')).toBe(false)
  })
})

// ── AtcPluginRuntime ──────────────────────────────────────────────────────────

describe('AtcPluginRuntime — assertPermission', () => {
  it('passes when plugin has the capability', () => {
    const runtime = new AtcPluginRuntime({ pluginId: 'my-plugin', capabilities: ['inventory.read'] })
    expect(() => runtime.assertPermission('inventory.read')).not.toThrow()
  })

  it('throws and increments denial counter when capability is missing', () => {
    const runtime = new AtcPluginRuntime({ pluginId: 'my-plugin', capabilities: [] })
    expect(() => runtime.assertPermission('vitals.write')).toThrow(AtcPermissionDeniedError)
    expect(runtime.getMetrics().permissionDeniedCount).toBe(1)
  })

  it('logs a warning via the provided logger on denial', () => {
    const logger = { warn: vi.fn() }
    const runtime = new AtcPluginRuntime({
      pluginId: 'my-plugin',
      capabilities: [],
      logger,
    })
    try { runtime.assertPermission('admin.write') } catch { /* expected */ }
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ pluginId: 'my-plugin', capability: 'admin.write' }),
      'plugin permission denied',
    )
  })
})

describe('AtcPluginRuntime — assertAnyPermission', () => {
  it('passes when at least one capability matches', () => {
    const runtime = new AtcPluginRuntime({ pluginId: 'p', capabilities: ['status.read'] })
    expect(() => runtime.assertAnyPermission(['vitals.write', 'status.read'])).not.toThrow()
  })

  it('throws and increments denial counter when none match', () => {
    const runtime = new AtcPluginRuntime({ pluginId: 'p', capabilities: [] })
    expect(() => runtime.assertAnyPermission(['vitals.write', 'inventory.write'])).toThrow()
    expect(runtime.getMetrics().permissionDeniedCount).toBe(1)
  })
})

describe('AtcPluginRuntime — metrics tracking', () => {
  it('tracks event publishes and subscribes', () => {
    const runtime = new AtcPluginRuntime({ pluginId: 'p', capabilities: ['events.publish', 'events.subscribe'] })
    runtime.trackEventPublished()
    runtime.trackEventPublished()
    runtime.trackEventSubscribed()
    const m = runtime.getMetrics()
    expect(m.eventsPublished).toBe(2)
    expect(m.eventsSubscribed).toBe(1)
    expect(m.permissionDeniedCount).toBe(0)
    expect(m.pluginId).toBe('p')
  })

  it('getMetrics returns a snapshot with registeredAt set', () => {
    const before = new Date().toISOString()
    const runtime = new AtcPluginRuntime({ pluginId: 'snap-plugin', capabilities: [] })
    const after = new Date().toISOString()
    expect(runtime.getMetrics().registeredAt >= before).toBe(true)
    expect(runtime.getMetrics().registeredAt <= after).toBe(true)
  })
})

// ── capability constants ───────────────────────────────────────────────────────

describe('ATC_CAPABILITIES', () => {
  it('contains exactly 32 capabilities', () => {
    expect(ATC_CAPABILITIES).toHaveLength(32)
  })

  it('does not include wildcard', () => {
    expect(ATC_CAPABILITIES).not.toContain('*')
  })

  it('all entries pass isValidCapability', () => {
    for (const cap of ATC_CAPABILITIES) {
      expect(isValidCapability(cap)).toBe(true)
    }
  })
})

// ── schema validation (Zod layer) ─────────────────────────────────────────────

describe('AtcPluginPermissionGuard — deny-by-default', () => {
  it('a plugin with no capabilities cannot perform any action', () => {
    const runtime = new AtcPluginRuntime({ pluginId: 'empty-plugin', capabilities: [] })
    const denied: AtcPluginCapability[] = []
    for (const cap of ATC_CAPABILITIES) {
      if (!runtime.hasPermission(cap)) denied.push(cap)
    }
    expect(denied).toHaveLength(32)
  })
})
