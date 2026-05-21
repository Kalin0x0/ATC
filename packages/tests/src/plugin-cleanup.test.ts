import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PluginCleanupManager } from '@atc/plugin-runtime-api'

describe('PluginCleanupManager', () => {
  let manager: PluginCleanupManager

  beforeEach(() => {
    vi.useFakeTimers()
    manager = new PluginCleanupManager()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('onCleanup', () => {
    it('invokes registered callbacks on dispose', () => {
      const fn = vi.fn()
      manager.onCleanup(fn)
      manager.dispose()
      expect(fn).toHaveBeenCalledOnce()
    })

    it('invokes multiple callbacks in registration order', () => {
      const calls: number[] = []
      manager.onCleanup(() => calls.push(1))
      manager.onCleanup(() => calls.push(2))
      manager.onCleanup(() => calls.push(3))
      manager.dispose()
      expect(calls).toEqual([1, 2, 3])
    })

    it('swallows errors in callbacks so dispose completes fully', () => {
      const fn1 = vi.fn(() => { throw new Error('boom') })
      const fn2 = vi.fn()
      manager.onCleanup(fn1)
      manager.onCleanup(fn2)
      expect(() => manager.dispose()).not.toThrow()
      expect(fn2).toHaveBeenCalled()
    })

    it('ignores onCleanup calls after dispose', () => {
      manager.dispose()
      const fn = vi.fn()
      manager.onCleanup(fn)
      expect(fn).not.toHaveBeenCalled()
    })
  })

  describe('scheduleTimeout', () => {
    it('fires the callback after the delay', () => {
      const fn = vi.fn()
      manager.scheduleTimeout(fn, 500)
      expect(fn).not.toHaveBeenCalled()
      vi.advanceTimersByTime(500)
      expect(fn).toHaveBeenCalledOnce()
    })

    it('removes timer from active count after firing', () => {
      manager.scheduleTimeout(() => {}, 100)
      expect(manager.activeTimers()).toBe(1)
      vi.advanceTimersByTime(100)
      expect(manager.activeTimers()).toBe(0)
    })

    it('cancels pending timers on dispose', () => {
      const fn = vi.fn()
      manager.scheduleTimeout(fn, 1000)
      expect(manager.activeTimers()).toBe(1)
      manager.dispose()
      expect(manager.activeTimers()).toBe(0)
      vi.advanceTimersByTime(2000)
      expect(fn).not.toHaveBeenCalled()
    })

    it('ignores scheduleTimeout calls after dispose', () => {
      manager.dispose()
      manager.scheduleTimeout(() => {}, 100)
      expect(manager.activeTimers()).toBe(0)
    })
  })

  describe('scheduleInterval', () => {
    it('fires the callback repeatedly', () => {
      const fn = vi.fn()
      manager.scheduleInterval(fn, 200)
      vi.advanceTimersByTime(600)
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('reports active intervals count', () => {
      manager.scheduleInterval(() => {}, 100)
      manager.scheduleInterval(() => {}, 200)
      expect(manager.activeIntervals()).toBe(2)
    })

    it('cancels intervals on dispose', () => {
      const fn = vi.fn()
      manager.scheduleInterval(fn, 100)
      manager.dispose()
      expect(manager.activeIntervals()).toBe(0)
      vi.advanceTimersByTime(500)
      expect(fn).not.toHaveBeenCalled()
    })
  })

  describe('dispose', () => {
    it('is idempotent — second call is a no-op', () => {
      const fn = vi.fn()
      manager.onCleanup(fn)
      manager.dispose()
      manager.dispose()
      expect(fn).toHaveBeenCalledOnce()
    })

    it('resets all counts to zero after dispose', () => {
      manager.scheduleTimeout(() => {}, 1000)
      manager.scheduleInterval(() => {}, 500)
      manager.dispose()
      expect(manager.activeTimers()).toBe(0)
      expect(manager.activeIntervals()).toBe(0)
    })

    it('clears all resources before callbacks run', () => {
      let timersOnCleanup = -1
      manager.scheduleTimeout(() => {}, 5000)
      manager.onCleanup(() => {
        timersOnCleanup = manager.activeTimers()
      })
      manager.dispose()
      expect(timersOnCleanup).toBe(0)
    })
  })
})
