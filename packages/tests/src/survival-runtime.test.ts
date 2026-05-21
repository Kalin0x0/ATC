import { describe, it, expect } from 'vitest'
import {
  SurvivalRuntimeError,
  SurvivalStateNotFoundError,
  TemperatureStateNotFoundError,
  HydrationStateNotFoundError,
  FatigueStateNotFoundError,
  EnvironmentalHazardNotFoundError,
  HazardAlreadyActiveError,
  ExposureConflictError,
} from '@atc/survival-runtime'
import {
  survivalTickSchema,
  applyPenaltySchema,
  reconcileSurvivalSchema,
  recordDrinkSchema,
  recordRestSchema,
  createHazardSchema,
  deactivateHazardSchema,
  recordExposureSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('SurvivalRuntimeError hierarchy', () => {
  it('SurvivalStateNotFoundError extends SurvivalRuntimeError', () => {
    const e = new SurvivalStateNotFoundError('player-1')
    expect(e).toBeInstanceOf(SurvivalRuntimeError)
    expect(e.message).toContain('player-1')
    expect(e.name).toBe('SurvivalStateNotFoundError')
  })

  it('TemperatureStateNotFoundError extends SurvivalRuntimeError', () => {
    const e = new TemperatureStateNotFoundError('player-2')
    expect(e).toBeInstanceOf(SurvivalRuntimeError)
    expect(e.message).toContain('player-2')
  })

  it('HydrationStateNotFoundError extends SurvivalRuntimeError', () => {
    const e = new HydrationStateNotFoundError('player-3')
    expect(e).toBeInstanceOf(SurvivalRuntimeError)
    expect(e.message).toContain('player-3')
  })

  it('FatigueStateNotFoundError extends SurvivalRuntimeError', () => {
    const e = new FatigueStateNotFoundError('player-4')
    expect(e).toBeInstanceOf(SurvivalRuntimeError)
    expect(e.message).toContain('player-4')
  })

  it('EnvironmentalHazardNotFoundError extends SurvivalRuntimeError', () => {
    const e = new EnvironmentalHazardNotFoundError('hazard-1')
    expect(e).toBeInstanceOf(SurvivalRuntimeError)
    expect(e.message).toContain('hazard-1')
  })

  it('HazardAlreadyActiveError extends SurvivalRuntimeError', () => {
    const e = new HazardAlreadyActiveError('hazard-2')
    expect(e).toBeInstanceOf(SurvivalRuntimeError)
    expect(e.message).toContain('hazard-2')
  })

  it('ExposureConflictError extends SurvivalRuntimeError', () => {
    const e = new ExposureConflictError('player-5', 'hazard-3')
    expect(e).toBeInstanceOf(SurvivalRuntimeError)
    expect(e.message).toContain('player-5')
    expect(e.message).toContain('hazard-3')
  })
})

// ── Schema Validation ─────────────────────────────────────────────────────────

describe('survivalTickSchema', () => {
  it('accepts valid tick', () => {
    const result = survivalTickSchema.safeParse({
      playerId:       'player-1',
      ownerServerId:  'server-1',
      bodyTemp:       37.0,
      hydrationLevel: 85.0,
      fatigueLevel:   20.0,
      survivalStatus: 'normal',
    })
    expect(result.success).toBe(true)
  })

  it('accepts tick with optional fields', () => {
    const result = survivalTickSchema.safeParse({
      playerId:       'player-1',
      ownerServerId:  'server-1',
      bodyTemp:       34.0,
      hydrationLevel: 10.0,
      fatigueLevel:   90.0,
      survivalStatus: 'critical',
      tempTrend:      -0.5,
      depletionRate:  0.1,
      restDebt:       45.0,
      exposureZone:   'zone-arctic',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid survival status', () => {
    const result = survivalTickSchema.safeParse({
      playerId:       'player-1',
      ownerServerId:  'server-1',
      bodyTemp:       37.0,
      hydrationLevel: 100.0,
      fatigueLevel:   0.0,
      survivalStatus: 'unknown_status',
    })
    expect(result.success).toBe(false)
  })

  it('requires ownerServerId', () => {
    const result = survivalTickSchema.safeParse({
      playerId:       'player-1',
      bodyTemp:       37.0,
      hydrationLevel: 100.0,
      fatigueLevel:   0.0,
      survivalStatus: 'normal',
    })
    expect(result.success).toBe(false)
  })
})

describe('applyPenaltySchema', () => {
  it('accepts valid penalty', () => {
    const result = applyPenaltySchema.safeParse({
      playerId:    'player-1',
      penaltyFlag: 'hypothermia',
      reason:      'body temp below 35°C',
    })
    expect(result.success).toBe(true)
  })

  it('requires reason', () => {
    const result = applyPenaltySchema.safeParse({
      playerId:    'player-1',
      penaltyFlag: 'dehydration',
    })
    expect(result.success).toBe(false)
  })
})

describe('reconcileSurvivalSchema', () => {
  it('accepts array of player ids', () => {
    const result = reconcileSurvivalSchema.safeParse({
      activePlayerIds: ['player-1', 'player-2', 'player-3'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty array', () => {
    const result = reconcileSurvivalSchema.safeParse({ activePlayerIds: [] })
    expect(result.success).toBe(true)
  })
})

describe('recordDrinkSchema', () => {
  it('accepts valid drink', () => {
    const result = recordDrinkSchema.safeParse({ playerId: 'player-1', amount: 25.0 })
    expect(result.success).toBe(true)
  })

  it('rejects negative amount', () => {
    const result = recordDrinkSchema.safeParse({ playerId: 'player-1', amount: -5 })
    expect(result.success).toBe(false)
  })
})

describe('recordRestSchema', () => {
  it('accepts valid rest', () => {
    const result = recordRestSchema.safeParse({ playerId: 'player-1', recoveryAmount: 30.0 })
    expect(result.success).toBe(true)
  })
})

describe('createHazardSchema', () => {
  it('accepts valid hazard', () => {
    const result = createHazardSchema.safeParse({
      hazardId:   'hazard-1',
      hazardType: 'radiation',
      zoneId:     'zone-nuclear',
      severity:   75.0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts hazard with ownerServerId', () => {
    const result = createHazardSchema.safeParse({
      hazardId:      'hazard-2',
      hazardType:    'toxic_gas',
      zoneId:        'zone-industrial',
      severity:      50.0,
      ownerServerId: 'server-1',
    })
    expect(result.success).toBe(true)
  })

  it('requires all mandatory fields', () => {
    const result = createHazardSchema.safeParse({ hazardId: 'hazard-3' })
    expect(result.success).toBe(false)
  })
})

describe('recordExposureSchema', () => {
  it('accepts valid exposure', () => {
    const result = recordExposureSchema.safeParse({
      playerId:     'player-1',
      hazardId:     'hazard-1',
      exposureType: 'radiation',
      severity:     40.0,
    })
    expect(result.success).toBe(true)
  })
})
