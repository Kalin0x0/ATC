import { describe, it, expect, vi } from 'vitest'
import { createPluginContext, AtcPermissionDeniedError } from '@atc/plugin-registry'

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}

// ── frozen context ─────────────────────────────────────────────────────────────

describe('createPluginContext — frozen context', () => {
  it('returns a frozen object', () => {
    const ctx = createPluginContext({
      pluginId: 'test-plugin',
      capabilities: ['inventory.read'],
      logger: makeLogger(),
    })
    expect(Object.isFrozen(ctx)).toBe(true)
  })

  it('cannot reassign pluginId', () => {
    const ctx = createPluginContext({
      pluginId: 'test-plugin',
      capabilities: [],
      logger: makeLogger(),
    })
    expect(() => {
      // @ts-expect-error intentional
      ctx.pluginId = 'other'
    }).toThrow()
  })

  it('capabilities array is frozen', () => {
    const ctx = createPluginContext({
      pluginId: 'test-plugin',
      capabilities: ['inventory.read'],
      logger: makeLogger(),
    })
    expect(Object.isFrozen(ctx.capabilities)).toBe(true)
  })

  it('cannot mutate capabilities via returned reference', () => {
    const ctx = createPluginContext({
      pluginId: 'test-plugin',
      capabilities: ['inventory.read'],
      logger: makeLogger(),
    })
    expect(() => {
      // @ts-expect-error intentional
      ;(ctx.capabilities as string[]).push('admin.write')
    }).toThrow()
    expect(ctx.capabilities).toHaveLength(1)
  })

  it('logger is frozen', () => {
    const ctx = createPluginContext({
      pluginId: 'test-plugin',
      capabilities: [],
      logger: makeLogger(),
    })
    expect(Object.isFrozen(ctx.logger)).toBe(true)
  })

  it('retains pluginId', () => {
    const ctx = createPluginContext({
      pluginId: 'my-plugin',
      capabilities: [],
      logger: makeLogger(),
    })
    expect(ctx.pluginId).toBe('my-plugin')
  })
})

// ── permission checks ──────────────────────────────────────────────────────────

describe('createPluginContext — hasPermission', () => {
  it('returns true for declared capability', () => {
    const ctx = createPluginContext({
      pluginId: 'p1',
      capabilities: ['inventory.read'],
      logger: makeLogger(),
    })
    expect(ctx.hasPermission('inventory.read')).toBe(true)
  })

  it('returns false for undeclared capability', () => {
    const ctx = createPluginContext({
      pluginId: 'p1',
      capabilities: ['inventory.read'],
      logger: makeLogger(),
    })
    expect(ctx.hasPermission('admin.write')).toBe(false)
  })

  it('returns false for all capabilities when none declared', () => {
    const ctx = createPluginContext({
      pluginId: 'p1',
      capabilities: [],
      logger: makeLogger(),
    })
    expect(ctx.hasPermission('inventory.read')).toBe(false)
    expect(ctx.hasPermission('events.publish')).toBe(false)
  })

  it('handles multiple capabilities correctly', () => {
    const ctx = createPluginContext({
      pluginId: 'p1',
      capabilities: ['inventory.read', 'vitals.write', 'events.publish'],
      logger: makeLogger(),
    })
    expect(ctx.hasPermission('inventory.read')).toBe(true)
    expect(ctx.hasPermission('vitals.write')).toBe(true)
    expect(ctx.hasPermission('events.publish')).toBe(true)
    expect(ctx.hasPermission('admin.read')).toBe(false)
  })
})

// ── assertPermission ───────────────────────────────────────────────────────────

describe('createPluginContext — assertPermission', () => {
  it('does not throw when capability is declared', () => {
    const ctx = createPluginContext({
      pluginId: 'p1',
      capabilities: ['events.subscribe'],
      logger: makeLogger(),
    })
    expect(() => ctx.assertPermission('events.subscribe')).not.toThrow()
  })

  it('throws AtcPermissionDeniedError for undeclared capability', () => {
    const ctx = createPluginContext({
      pluginId: 'p1',
      capabilities: ['inventory.read'],
      logger: makeLogger(),
    })
    expect(() => ctx.assertPermission('admin.write')).toThrow(AtcPermissionDeniedError)
  })

  it('error message contains pluginId and capability', () => {
    const ctx = createPluginContext({
      pluginId: 'food-plugin',
      capabilities: [],
      logger: makeLogger(),
    })
    try {
      ctx.assertPermission('wallet.write')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AtcPermissionDeniedError)
      expect((err as Error).message).toContain('food-plugin')
      expect((err as Error).message).toContain('wallet.write')
    }
  })
})

// ── logger delegation ──────────────────────────────────────────────────────────

describe('createPluginContext — logger', () => {
  it('delegates info to underlying logger', () => {
    const raw = makeLogger()
    const ctx = createPluginContext({ pluginId: 'p1', capabilities: [], logger: raw })
    ctx.logger.info('hello', { x: 1 })
    expect(raw.info).toHaveBeenCalledWith('hello', { x: 1 })
  })

  it('delegates warn to underlying logger', () => {
    const raw = makeLogger()
    const ctx = createPluginContext({ pluginId: 'p1', capabilities: [], logger: raw })
    ctx.logger.warn('uh-oh')
    expect(raw.warn).toHaveBeenCalledWith('uh-oh', undefined)
  })

  it('delegates error to underlying logger', () => {
    const raw = makeLogger()
    const ctx = createPluginContext({ pluginId: 'p1', capabilities: [], logger: raw })
    ctx.logger.error('boom', { err: 'oops' })
    expect(raw.error).toHaveBeenCalledWith('boom', { err: 'oops' })
  })

  it('delegates debug to underlying logger', () => {
    const raw = makeLogger()
    const ctx = createPluginContext({ pluginId: 'p1', capabilities: [], logger: raw })
    ctx.logger.debug('trace')
    expect(raw.debug).toHaveBeenCalledWith('trace', undefined)
  })
})
