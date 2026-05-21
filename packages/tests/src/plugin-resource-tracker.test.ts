import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AtcPluginResourceTracker } from '@atc/plugin-runtime'

describe('AtcPluginResourceTracker', () => {
  let tracker: AtcPluginResourceTracker

  beforeEach(() => {
    tracker = new AtcPluginResourceTracker()
  })

  describe('initial state', () => {
    it('has zero counts', () => {
      const snap = tracker.getSnapshot()
      expect(snap.activeTimers).toBe(0)
      expect(snap.activeIntervals).toBe(0)
      expect(snap.activeSubscriptions).toBe(0)
      expect(snap.activeWorkers).toBe(0)
      expect(snap.crashCount).toBe(0)
      expect(snap.restartCount).toBe(0)
      expect(snap.lastCrashAt).toBeNull()
    })

    it('uptimeMs is 0 when not started', () => {
      expect(tracker.getSnapshot().uptimeMs).toBe(0)
    })
  })

  describe('markStarted / markStopped', () => {
    it('uptimeMs > 0 after markStarted', async () => {
      tracker.markStarted()
      await new Promise((r) => setTimeout(r, 5))
      expect(tracker.getSnapshot().uptimeMs).toBeGreaterThan(0)
    })

    it('uptimeMs returns 0 after markStopped', async () => {
      tracker.markStarted()
      await new Promise((r) => setTimeout(r, 5))
      tracker.markStopped()
      expect(tracker.getSnapshot().uptimeMs).toBe(0)
    })
  })

  describe('trackTimer', () => {
    it('increments activeTimers on track', () => {
      tracker.trackTimer()
      expect(tracker.getSnapshot().activeTimers).toBe(1)
    })

    it('decrements activeTimers when unsubscribe called', () => {
      const untrack = tracker.trackTimer()
      untrack()
      expect(tracker.getSnapshot().activeTimers).toBe(0)
    })

    it('does not go below 0', () => {
      const untrack = tracker.trackTimer()
      untrack()
      untrack() // second call should not underflow
      expect(tracker.getSnapshot().activeTimers).toBe(0)
    })

    it('tracks multiple timers', () => {
      const u1 = tracker.trackTimer()
      const u2 = tracker.trackTimer()
      expect(tracker.getSnapshot().activeTimers).toBe(2)
      u1()
      expect(tracker.getSnapshot().activeTimers).toBe(1)
      u2()
      expect(tracker.getSnapshot().activeTimers).toBe(0)
    })
  })

  describe('trackInterval', () => {
    it('increments and decrements correctly', () => {
      const untrack = tracker.trackInterval()
      expect(tracker.getSnapshot().activeIntervals).toBe(1)
      untrack()
      expect(tracker.getSnapshot().activeIntervals).toBe(0)
    })
  })

  describe('trackSubscription', () => {
    it('increments and decrements correctly', () => {
      const untrack = tracker.trackSubscription()
      expect(tracker.getSnapshot().activeSubscriptions).toBe(1)
      untrack()
      expect(tracker.getSnapshot().activeSubscriptions).toBe(0)
    })
  })

  describe('trackWorker', () => {
    it('increments and decrements correctly', () => {
      const untrack = tracker.trackWorker()
      expect(tracker.getSnapshot().activeWorkers).toBe(1)
      untrack()
      expect(tracker.getSnapshot().activeWorkers).toBe(0)
    })
  })

  describe('recordCrash', () => {
    it('increments crashCount', () => {
      tracker.recordCrash('boom')
      expect(tracker.getCrashCount()).toBe(1)
    })

    it('sets lastCrashAt', () => {
      tracker.recordCrash('oops')
      expect(tracker.getSnapshot().lastCrashAt).not.toBeNull()
    })

    it('accumulates across multiple crashes', () => {
      tracker.recordCrash('first')
      tracker.recordCrash('second')
      tracker.recordCrash('third')
      expect(tracker.getCrashCount()).toBe(3)
    })
  })

  describe('recordRestart', () => {
    it('increments restartCount', () => {
      tracker.recordRestart()
      expect(tracker.getRestartCount()).toBe(1)
    })

    it('clears startedAt on restart', async () => {
      tracker.markStarted()
      await new Promise((r) => setTimeout(r, 5))
      tracker.recordRestart()
      expect(tracker.getSnapshot().uptimeMs).toBe(0)
    })
  })

  describe('resetResources', () => {
    it('zeros all resource counters', () => {
      tracker.trackTimer()
      tracker.trackInterval()
      tracker.trackSubscription()
      tracker.trackWorker()
      tracker.resetResources()
      const snap = tracker.getSnapshot()
      expect(snap.activeTimers).toBe(0)
      expect(snap.activeIntervals).toBe(0)
      expect(snap.activeSubscriptions).toBe(0)
      expect(snap.activeWorkers).toBe(0)
    })

    it('does not reset crash or restart counts', () => {
      tracker.recordCrash('boom')
      tracker.recordRestart()
      tracker.resetResources()
      expect(tracker.getCrashCount()).toBe(1)
      expect(tracker.getRestartCount()).toBe(1)
    })
  })

  describe('getSnapshot', () => {
    it('returns a snapshot with estimatedMemoryBytes', () => {
      const snap = tracker.getSnapshot()
      expect(snap.estimatedMemoryBytes).toBe(0)
    })

    it('returns independent snapshots (not references)', () => {
      const snap1 = tracker.getSnapshot()
      tracker.trackTimer()
      const snap2 = tracker.getSnapshot()
      expect(snap1.activeTimers).toBe(0)
      expect(snap2.activeTimers).toBe(1)
    })
  })
})
