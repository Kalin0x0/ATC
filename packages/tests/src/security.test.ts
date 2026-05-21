import { describe, it, expect } from 'vitest'
import {
  getRiskLevel,
  ATC_RISK_THRESHOLDS,
  ATC_VIOLATION_POINTS,
  hasPermission,
  ATC_ADMIN_LEVEL_PERMISSIONS,
} from '@atc/shared-types'
import { buildRiskScore, calculateRiskPoints } from '@atc/sdk'

describe('getRiskLevel', () => {
  it('returns normal below elevated threshold', () => {
    expect(getRiskLevel(0)).toBe('normal')
    expect(getRiskLevel(ATC_RISK_THRESHOLDS.elevated - 1)).toBe('normal')
  })

  it('returns elevated at threshold', () => {
    expect(getRiskLevel(ATC_RISK_THRESHOLDS.elevated)).toBe('elevated')
    expect(getRiskLevel(ATC_RISK_THRESHOLDS.high - 1)).toBe('elevated')
  })

  it('returns high at threshold', () => {
    expect(getRiskLevel(ATC_RISK_THRESHOLDS.high)).toBe('high')
    expect(getRiskLevel(ATC_RISK_THRESHOLDS.critical - 1)).toBe('high')
  })

  it('returns critical at threshold', () => {
    expect(getRiskLevel(ATC_RISK_THRESHOLDS.critical)).toBe('critical')
    expect(getRiskLevel(999)).toBe('critical')
  })

  it('risk thresholds are ordered correctly', () => {
    expect(ATC_RISK_THRESHOLDS.elevated).toBeLessThan(ATC_RISK_THRESHOLDS.high)
    expect(ATC_RISK_THRESHOLDS.high).toBeLessThan(ATC_RISK_THRESHOLDS.critical)
  })
})

describe('calculateRiskPoints', () => {
  it('returns the canonical violation points', () => {
    expect(calculateRiskPoints('EVENT_NOT_WHITELISTED')).toBe(
      ATC_VIOLATION_POINTS.EVENT_NOT_WHITELISTED
    )
    expect(calculateRiskPoints('INVENTORY_DUPE_DETECTED')).toBe(
      ATC_VIOLATION_POINTS.INVENTORY_DUPE_DETECTED
    )
  })

  it('returns custom points when provided', () => {
    expect(calculateRiskPoints('NO_SESSION', 99)).toBe(99)
  })
})

describe('buildRiskScore', () => {
  it('sums points correctly and assigns level', () => {
    const events = [
      { type: 'NO_SESSION' as const, points: 5, description: 'test', timestamp: Date.now() },
      { type: 'NO_SESSION' as const, points: 5, description: 'test', timestamp: Date.now() },
    ]
    const score = buildRiskScore('license:abc', events)
    expect(score.score).toBe(10)
    expect(score.level).toBe('normal')
    expect(score.identifier).toBe('license:abc')
  })

  it('returns critical level when score >= 85', () => {
    const events = Array.from({ length: 2 }, () => ({
      type: 'INVENTORY_DUPE_DETECTED' as const,
      points: 50,
      description: 'dupe',
      timestamp: Date.now(),
    }))
    const score = buildRiskScore('license:abc', events)
    expect(score.score).toBe(100)
    expect(score.level).toBe('critical')
  })
})

describe('hasPermission', () => {
  it('returns true when permission is in the granted list', () => {
    expect(hasPermission(['player.read', 'admin.kick'], 'player.read')).toBe(true)
  })

  it('returns false when permission is missing', () => {
    expect(hasPermission(['player.read'], 'admin.ban')).toBe(false)
    expect(hasPermission([], 'player.read')).toBe(false)
  })
})

describe('ATC_ADMIN_LEVEL_PERMISSIONS', () => {
  it('level 0 has no permissions', () => {
    expect(ATC_ADMIN_LEVEL_PERMISSIONS[0]).toHaveLength(0)
  })

  it('level 5 has more permissions than level 1', () => {
    expect(ATC_ADMIN_LEVEL_PERMISSIONS[5].length).toBeGreaterThan(
      ATC_ADMIN_LEVEL_PERMISSIONS[1].length
    )
  })

  it('level 2 can ban but level 1 cannot', () => {
    expect(hasPermission(ATC_ADMIN_LEVEL_PERMISSIONS[2], 'admin.ban')).toBe(true)
    expect(hasPermission(ATC_ADMIN_LEVEL_PERMISSIONS[1], 'admin.ban')).toBe(false)
  })
})
