import { describe, it, expect } from 'vitest'
import {
  DisasterRuntimeError,
  DisasterEventNotFoundError,
  DuplicateDisasterNonceError,
  DisasterAlreadyContainedError,
  HazardZoneNotFoundError,
  EvacuationNotFoundError,
  DuplicateEvacuationNonceError,
  EmergencyResponseNotFoundError,
  RecoveryRuntimeNotFoundError,
} from '@atc/disaster-runtime'
import {
  declareDisasterSchema,
  updateDisasterStatusSchema,
  propagateHazardSchema,
  clearHazardZoneSchema,
  initiateEvacuationSchema,
  updateEvacuationProgressSchema,
  completeEvacuationSchema,
  dispatchResponseSchema,
  updateResponseStatusSchema,
  startRecoverySchema,
  updateRecoveryProgressSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('DisasterRuntimeError hierarchy', () => {
  it('DisasterEventNotFoundError extends DisasterRuntimeError', () => {
    const e = new DisasterEventNotFoundError('disaster-1')
    expect(e).toBeInstanceOf(DisasterRuntimeError)
    expect(e.message).toContain('disaster-1')
    expect(e.name).toBe('DisasterEventNotFoundError')
  })

  it('DuplicateDisasterNonceError extends DisasterRuntimeError', () => {
    const e = new DuplicateDisasterNonceError('nonce-d-1')
    expect(e).toBeInstanceOf(DisasterRuntimeError)
    expect(e.message).toContain('nonce-d-1')
  })

  it('DisasterAlreadyContainedError extends DisasterRuntimeError', () => {
    const e = new DisasterAlreadyContainedError('disaster-2')
    expect(e).toBeInstanceOf(DisasterRuntimeError)
    expect(e.message).toContain('disaster-2')
  })

  it('HazardZoneNotFoundError extends DisasterRuntimeError', () => {
    const e = new HazardZoneNotFoundError('zone-1')
    expect(e).toBeInstanceOf(DisasterRuntimeError)
    expect(e.message).toContain('zone-1')
  })

  it('EvacuationNotFoundError extends DisasterRuntimeError', () => {
    const e = new EvacuationNotFoundError('evacuation-1')
    expect(e).toBeInstanceOf(DisasterRuntimeError)
    expect(e.message).toContain('evacuation-1')
  })

  it('DuplicateEvacuationNonceError extends DisasterRuntimeError', () => {
    const e = new DuplicateEvacuationNonceError('nonce-ev-1')
    expect(e).toBeInstanceOf(DisasterRuntimeError)
    expect(e.message).toContain('nonce-ev-1')
  })

  it('EmergencyResponseNotFoundError extends DisasterRuntimeError', () => {
    const e = new EmergencyResponseNotFoundError('response-1')
    expect(e).toBeInstanceOf(DisasterRuntimeError)
    expect(e.message).toContain('response-1')
  })

  it('RecoveryRuntimeNotFoundError extends DisasterRuntimeError', () => {
    const e = new RecoveryRuntimeNotFoundError('disaster-3')
    expect(e).toBeInstanceOf(DisasterRuntimeError)
    expect(e.message).toContain('disaster-3')
  })
})

// ── Schema Validation ─────────────────────────────────────────────────────────

describe('declareDisasterSchema', () => {
  it('accepts valid disaster declaration', () => {
    const result = declareDisasterSchema.safeParse({
      disasterNonce: 'nonce-disaster-abc',
      disasterType:  'earthquake',
      disasterName:  'Earthquake Zone A',
      severity:      75.0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts declaration with all optional fields', () => {
    const result = declareDisasterSchema.safeParse({
      disasterNonce:              'nonce-disaster-xyz',
      disasterType:               'fire',
      disasterName:               'Industrial Fire',
      severity:                   90.0,
      affectedZoneIds:            ['zone-1', 'zone-2'],
      initiatedByPrincipalId:     'principal-chief-1',
      ownerServerId:              'server-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all disaster types', () => {
    for (const disasterType of ['earthquake', 'flood', 'fire', 'chemical', 'nuclear', 'storm', 'blackout', 'pandemic', 'riot', 'custom'] as const) {
      const result = declareDisasterSchema.safeParse({
        disasterNonce: `nonce-${disasterType}`,
        disasterType,
        disasterName:  `Test ${disasterType}`,
        severity:      50.0,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects severity out of range', () => {
    const result = declareDisasterSchema.safeParse({
      disasterNonce: 'nonce-1',
      disasterType:  'fire',
      disasterName:  'Test',
      severity:      150.0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid disaster type', () => {
    const result = declareDisasterSchema.safeParse({
      disasterNonce: 'nonce-1',
      disasterType:  'tornado',
      disasterName:  'Test',
      severity:      50.0,
    })
    expect(result.success).toBe(false)
  })
})

describe('updateDisasterStatusSchema', () => {
  it('accepts all valid statuses', () => {
    for (const status of ['active', 'contained', 'resolved', 'escalated'] as const) {
      const result = updateDisasterStatusSchema.safeParse({ disasterId: 'disaster-1', status })
      expect(result.success).toBe(true)
    }
  })
})

describe('propagateHazardSchema', () => {
  it('accepts valid hazard propagation', () => {
    const result = propagateHazardSchema.safeParse({
      zoneId:     'zone-hazard-1',
      hazardType: 'radiation',
      severity:   80.0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts propagation with optional fields', () => {
    const result = propagateHazardSchema.safeParse({
      zoneId:             'zone-hazard-2',
      disasterId:         'disaster-1',
      hazardType:         'chemical',
      severity:           60.0,
      propagationRadius:  500.0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts all hazard types', () => {
    for (const hazardType of ['radiation', 'chemical', 'biological', 'fire', 'flood', 'structural', 'exclusion'] as const) {
      const result = propagateHazardSchema.safeParse({
        zoneId:     `zone-${hazardType}`,
        hazardType,
        severity:   50.0,
      })
      expect(result.success).toBe(true)
    }
  })
})

describe('clearHazardZoneSchema', () => {
  it('accepts valid zone clear', () => {
    const result = clearHazardZoneSchema.safeParse({ zoneId: 'zone-1' })
    expect(result.success).toBe(true)
  })
})

describe('initiateEvacuationSchema', () => {
  it('accepts valid evacuation', () => {
    const result = initiateEvacuationSchema.safeParse({
      evacuationNonce: 'nonce-ev-abc',
      zoneId:          'zone-downtown',
      evacuationType:  'civilian',
    })
    expect(result.success).toBe(true)
  })

  it('accepts evacuation with optional fields', () => {
    const result = initiateEvacuationSchema.safeParse({
      evacuationNonce: 'nonce-ev-xyz',
      disasterId:      'disaster-1',
      zoneId:          'zone-industrial',
      evacuationType:  'emergency',
      targetCount:     500,
    })
    expect(result.success).toBe(true)
  })

  it('requires evacuationNonce', () => {
    const result = initiateEvacuationSchema.safeParse({
      zoneId:         'zone-1',
      evacuationType: 'civilian',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateEvacuationProgressSchema', () => {
  it('accepts valid progress update', () => {
    const result = updateEvacuationProgressSchema.safeParse({
      evacuationId:   'evacuation-1',
      evacuatedCount: 150,
    })
    expect(result.success).toBe(true)
  })

  it('accepts zero count', () => {
    const result = updateEvacuationProgressSchema.safeParse({
      evacuationId:   'evacuation-1',
      evacuatedCount: 0,
    })
    expect(result.success).toBe(true)
  })
})

describe('completeEvacuationSchema', () => {
  it('accepts valid completion', () => {
    const result = completeEvacuationSchema.safeParse({ evacuationId: 'evacuation-1' })
    expect(result.success).toBe(true)
  })
})

describe('dispatchResponseSchema', () => {
  it('accepts valid dispatch', () => {
    const result = dispatchResponseSchema.safeParse({ responseType: 'fire_brigade' })
    expect(result.success).toBe(true)
  })

  it('accepts all response types', () => {
    for (const responseType of ['fire_brigade', 'medical', 'police', 'military', 'hazmat', 'search_rescue', 'civil_defense'] as const) {
      const result = dispatchResponseSchema.safeParse({ responseType })
      expect(result.success).toBe(true)
    }
  })

  it('accepts dispatch with optional fields', () => {
    const result = dispatchResponseSchema.safeParse({
      disasterId:            'disaster-1',
      responseType:          'hazmat',
      responderPrincipalId:  'principal-hazmat-1',
    })
    expect(result.success).toBe(true)
  })
})

describe('updateResponseStatusSchema', () => {
  it('accepts all valid statuses', () => {
    for (const status of ['dispatched', 'on_scene', 'withdrawn', 'completed'] as const) {
      const result = updateResponseStatusSchema.safeParse({ responseId: 'response-1', status })
      expect(result.success).toBe(true)
    }
  })
})

describe('startRecoverySchema', () => {
  it('accepts valid recovery start', () => {
    const result = startRecoverySchema.safeParse({
      disasterId:      'disaster-1',
      recoveryPhase:   'debris_clearance',
      progressPercent: 0.0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts recovery with estimated completion', () => {
    const result = startRecoverySchema.safeParse({
      disasterId:              'disaster-1',
      recoveryPhase:           'reconstruction',
      progressPercent:         25.0,
      estimatedCompletionAt:   '2026-06-15T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('updateRecoveryProgressSchema', () => {
  it('accepts valid progress', () => {
    const result = updateRecoveryProgressSchema.safeParse({
      disasterId:      'disaster-1',
      progressPercent: 75.5,
    })
    expect(result.success).toBe(true)
  })

  it('rejects progress over 100', () => {
    const result = updateRecoveryProgressSchema.safeParse({
      disasterId:      'disaster-1',
      progressPercent: 101.0,
    })
    expect(result.success).toBe(false)
  })
})
