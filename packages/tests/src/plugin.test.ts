import { describe, it, expect } from 'vitest'
import { atcPluginManifestSchema } from '@atc/schemas'
import { AtcPluginRegistry } from '@atc/sdk'
import type { AtcPluginManifest } from '@atc/shared-types'

const VALID_MANIFEST: AtcPluginManifest = {
  id: 'atc-test-plugin',
  name: 'ATC Test Plugin',
  version: '1.0.0',
  apiVersion: '1',
  author: 'Atlantic Community',
  dependencies: {},
  permissions: ['player.read'],
  entryPoints: { server: 'server/index.lua' },
}

describe('atcPluginManifestSchema', () => {
  it('accepts a valid manifest', () => {
    const result = atcPluginManifestSchema.safeParse(VALID_MANIFEST)
    expect(result.success).toBe(true)
  })

  it('rejects an id with uppercase letters', () => {
    const result = atcPluginManifestSchema.safeParse({ ...VALID_MANIFEST, id: 'ATC-Plugin' })
    expect(result.success).toBe(false)
  })

  it('rejects an id with spaces', () => {
    const result = atcPluginManifestSchema.safeParse({ ...VALID_MANIFEST, id: 'my plugin' })
    expect(result.success).toBe(false)
  })

  it('rejects a bad semver version', () => {
    const result = atcPluginManifestSchema.safeParse({ ...VALID_MANIFEST, version: 'v1.0' })
    expect(result.success).toBe(false)
  })

  it('rejects a non-numeric apiVersion', () => {
    const result = atcPluginManifestSchema.safeParse({ ...VALID_MANIFEST, apiVersion: '1.0' })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown permission domain', () => {
    const result = atcPluginManifestSchema.safeParse({
      ...VALID_MANIFEST,
      permissions: ['weather.read'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown permission action', () => {
    const result = atcPluginManifestSchema.safeParse({
      ...VALID_MANIFEST,
      permissions: ['player.fly'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects malformed event names in events.publishes', () => {
    const result = atcPluginManifestSchema.safeParse({
      ...VALID_MANIFEST,
      events: { publishes: ['bad-event-name'] },
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid event names in events.subscribes', () => {
    const result = atcPluginManifestSchema.safeParse({
      ...VALID_MANIFEST,
      events: { subscribes: ['atc:player:connected'] },
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional fields when omitted', () => {
    const minimal = {
      id: 'min-plugin',
      name: 'Minimal Plugin',
      version: '0.1.0',
      apiVersion: '1',
      author: 'Test',
      dependencies: {},
      permissions: [],
      entryPoints: {},
    }
    const result = atcPluginManifestSchema.safeParse(minimal)
    expect(result.success).toBe(true)
  })
})

describe('AtcPluginRegistry', () => {
  it('registers a valid plugin', () => {
    const registry = new AtcPluginRegistry()
    const reg = registry.register(VALID_MANIFEST)
    expect(reg.status).toBe('registered')
    expect(reg.manifest.id).toBe('atc-test-plugin')
  })

  it('throws on duplicate registration of an active plugin', () => {
    const registry = new AtcPluginRegistry()
    registry.register(VALID_MANIFEST)
    expect(() => registry.register(VALID_MANIFEST)).toThrow()
  })

  it('throws on invalid manifest', () => {
    const registry = new AtcPluginRegistry()
    expect(() => registry.register({ id: '', name: 'bad' } as AtcPluginManifest)).toThrow()
  })

  it('resolveLoadOrder returns ids in dependency order', () => {
    const registry = new AtcPluginRegistry()
    registry.register(VALID_MANIFEST)
    const second: AtcPluginManifest = {
      ...VALID_MANIFEST,
      id: 'atc-dependent',
      name: 'Dependent',
      dependencies: { 'atc-test-plugin': '*' },
    }
    registry.register(second)
    const order = registry.resolveLoadOrder(['atc-dependent', 'atc-test-plugin'])
    expect(order.indexOf('atc-test-plugin')).toBeLessThan(order.indexOf('atc-dependent'))
  })

  it('isLoaded returns false before MarkReady', () => {
    const registry = new AtcPluginRegistry()
    registry.register(VALID_MANIFEST)
    expect(registry.isLoaded('atc-test-plugin')).toBe(false)
  })

  it('isLoaded returns true after setStatus ready', () => {
    const registry = new AtcPluginRegistry()
    registry.register(VALID_MANIFEST)
    registry.setStatus('atc-test-plugin', 'ready')
    expect(registry.isLoaded('atc-test-plugin')).toBe(true)
  })
})
