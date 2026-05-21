import { describe, it, expect } from 'vitest'
import {
  resolveDependencies,
  PluginDependencyCycleError,
  PluginMissingDependencyError,
  PluginVersionMismatchError,
} from '@atc/plugin-registry'

// ── happy path ────────────────────────────────────────────────────────────────

describe('resolveDependencies — happy path', () => {
  it('resolves a single plugin with no dependencies', () => {
    const { order } = resolveDependencies([{ id: 'a', version: '1.0.0' }])
    expect(order).toEqual(['a'])
  })

  it('resolves two plugins in dependency order', () => {
    const { order } = resolveDependencies([
      { id: 'food', version: '1.0.0', dependencies: [{ id: 'vitals', version: '^1.0.0' }] },
      { id: 'vitals', version: '1.2.0' },
    ])
    expect(order.indexOf('vitals')).toBeLessThan(order.indexOf('food'))
  })

  it('resolves a chain: A → B → C (C loads first)', () => {
    const { order } = resolveDependencies([
      { id: 'a', version: '1.0.0', dependencies: [{ id: 'b', version: '^1.0.0' }] },
      { id: 'b', version: '1.0.0', dependencies: [{ id: 'c', version: '^1.0.0' }] },
      { id: 'c', version: '1.0.0' },
    ])
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('b'))
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('a'))
  })

  it('produces deterministic output for same input', () => {
    const manifests = [
      { id: 'z', version: '1.0.0' },
      { id: 'a', version: '1.0.0' },
      { id: 'm', version: '1.0.0' },
    ]
    const r1 = resolveDependencies(manifests).order
    const r2 = resolveDependencies(manifests).order
    expect(r1).toEqual(r2)
  })

  it('handles diamond dependency (A→B, A→C, B→D, C→D)', () => {
    const { order } = resolveDependencies([
      { id: 'a', version: '1.0.0', dependencies: [{ id: 'b', version: '^1.0.0' }, { id: 'c', version: '^1.0.0' }] },
      { id: 'b', version: '1.0.0', dependencies: [{ id: 'd', version: '^1.0.0' }] },
      { id: 'c', version: '1.0.0', dependencies: [{ id: 'd', version: '^1.0.0' }] },
      { id: 'd', version: '1.0.0' },
    ])
    expect(order.indexOf('d')).toBeLessThan(order.indexOf('b'))
    expect(order.indexOf('d')).toBeLessThan(order.indexOf('c'))
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('a'))
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('a'))
  })
})

// ── version range checks ──────────────────────────────────────────────────────

describe('resolveDependencies — version ranges', () => {
  it('accepts caret range when major matches', () => {
    expect(() => resolveDependencies([
      { id: 'a', version: '1.0.0', dependencies: [{ id: 'b', version: '^1.0.0' }] },
      { id: 'b', version: '1.5.0' },
    ])).not.toThrow()
  })

  it('accepts tilde range when major.minor matches', () => {
    expect(() => resolveDependencies([
      { id: 'a', version: '1.0.0', dependencies: [{ id: 'b', version: '~1.5.0' }] },
      { id: 'b', version: '1.5.3' },
    ])).not.toThrow()
  })

  it('accepts exact version match', () => {
    expect(() => resolveDependencies([
      { id: 'a', version: '1.0.0', dependencies: [{ id: 'b', version: '2.3.4' }] },
      { id: 'b', version: '2.3.4' },
    ])).not.toThrow()
  })

  it('throws PluginVersionMismatchError when caret range fails (different major)', () => {
    expect(() => resolveDependencies([
      { id: 'a', version: '1.0.0', dependencies: [{ id: 'b', version: '^2.0.0' }] },
      { id: 'b', version: '1.9.9' },
    ])).toThrow(PluginVersionMismatchError)
  })

  it('error message includes plugin ids and versions', () => {
    try {
      resolveDependencies([
        { id: 'food', version: '1.0.0', dependencies: [{ id: 'vitals', version: '^2.0.0' }] },
        { id: 'vitals', version: '1.0.0' },
      ])
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(PluginVersionMismatchError)
      const e = err as PluginVersionMismatchError
      expect(e.pluginId).toBe('food')
      expect(e.dependencyId).toBe('vitals')
      expect(e.required).toBe('^2.0.0')
      expect(e.actual).toBe('1.0.0')
    }
  })
})

// ── missing dependency ────────────────────────────────────────────────────────

describe('resolveDependencies — missing dependency', () => {
  it('throws PluginMissingDependencyError when dep not in set', () => {
    expect(() => resolveDependencies([
      { id: 'food', version: '1.0.0', dependencies: [{ id: 'vitals', version: '^1.0.0' }] },
    ])).toThrow(PluginMissingDependencyError)
  })

  it('error contains pluginId and dependencyId', () => {
    try {
      resolveDependencies([
        { id: 'food', version: '1.0.0', dependencies: [{ id: 'missing-dep', version: '^1.0.0' }] },
      ])
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(PluginMissingDependencyError)
      const e = err as PluginMissingDependencyError
      expect(e.pluginId).toBe('food')
      expect(e.dependencyId).toBe('missing-dep')
    }
  })
})

// ── cycle detection ───────────────────────────────────────────────────────────

describe('resolveDependencies — cycle detection', () => {
  it('throws PluginDependencyCycleError for direct cycle A → B → A', () => {
    expect(() => resolveDependencies([
      { id: 'a', version: '1.0.0', dependencies: [{ id: 'b', version: '^1.0.0' }] },
      { id: 'b', version: '1.0.0', dependencies: [{ id: 'a', version: '^1.0.0' }] },
    ])).toThrow(PluginDependencyCycleError)
  })

  it('throws PluginDependencyCycleError for indirect cycle A → B → C → A', () => {
    expect(() => resolveDependencies([
      { id: 'a', version: '1.0.0', dependencies: [{ id: 'b', version: '^1.0.0' }] },
      { id: 'b', version: '1.0.0', dependencies: [{ id: 'c', version: '^1.0.0' }] },
      { id: 'c', version: '1.0.0', dependencies: [{ id: 'a', version: '^1.0.0' }] },
    ])).toThrow(PluginDependencyCycleError)
  })

  it('cycle error contains the cycle path', () => {
    try {
      resolveDependencies([
        { id: 'x', version: '1.0.0', dependencies: [{ id: 'y', version: '^1.0.0' }] },
        { id: 'y', version: '1.0.0', dependencies: [{ id: 'x', version: '^1.0.0' }] },
      ])
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(PluginDependencyCycleError)
      const e = err as PluginDependencyCycleError
      expect(e.cycle.length).toBeGreaterThan(0)
    }
  })

  it('resolves empty list without error', () => {
    expect(() => resolveDependencies([])).not.toThrow()
    expect(resolveDependencies([]).order).toHaveLength(0)
  })
})
