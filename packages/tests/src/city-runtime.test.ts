import { describe, it, expect } from 'vitest'
import {
  CityRuntimeError,
  UtilityGridNotFoundError,
  UtilityGridAlreadyDownError,
  UtilityGridAlreadyRestoredError,
  TrafficSignalNotFoundError,
  InfrastructureNotFoundError,
  InfrastructureFailureNotFoundError,
  InfrastructureAlreadyRecoveredError,
  EnvironmentRuntimeNotFoundError,
  DuplicateOutageError,
} from '@atc/city-runtime'
import {
  registerInfrastructureSchema,
  updateInfrastructureHealthSchema,
  reportInfrastructureFailureSchema,
  resolveInfrastructureFailureSchema,
  updateTrafficSignalSchema,
  updateEnvironmentSchema,
  recordResourceConsumptionSchema,
  reportUtilityOutageSchema,
  restoreUtilityGridSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('CityRuntimeError hierarchy', () => {
  it('UtilityGridNotFoundError extends CityRuntimeError', () => {
    const e = new UtilityGridNotFoundError('grid-1')
    expect(e).toBeInstanceOf(CityRuntimeError)
    expect(e.message).toContain('grid-1')
    expect(e.name).toBe('UtilityGridNotFoundError')
  })

  it('UtilityGridAlreadyDownError extends CityRuntimeError', () => {
    const e = new UtilityGridAlreadyDownError('grid-2')
    expect(e).toBeInstanceOf(CityRuntimeError)
    expect(e.message).toContain('grid-2')
  })

  it('UtilityGridAlreadyRestoredError extends CityRuntimeError', () => {
    const e = new UtilityGridAlreadyRestoredError('grid-3')
    expect(e).toBeInstanceOf(CityRuntimeError)
    expect(e.message).toContain('grid-3')
  })

  it('TrafficSignalNotFoundError extends CityRuntimeError', () => {
    const e = new TrafficSignalNotFoundError('signal-1')
    expect(e).toBeInstanceOf(CityRuntimeError)
    expect(e.message).toContain('signal-1')
  })

  it('InfrastructureNotFoundError extends CityRuntimeError', () => {
    const e = new InfrastructureNotFoundError('node-1')
    expect(e).toBeInstanceOf(CityRuntimeError)
    expect(e.message).toContain('node-1')
  })

  it('InfrastructureFailureNotFoundError extends CityRuntimeError', () => {
    const e = new InfrastructureFailureNotFoundError('fail-1')
    expect(e).toBeInstanceOf(CityRuntimeError)
    expect(e.message).toContain('fail-1')
  })

  it('InfrastructureAlreadyRecoveredError extends CityRuntimeError', () => {
    const e = new InfrastructureAlreadyRecoveredError('fail-2')
    expect(e).toBeInstanceOf(CityRuntimeError)
    expect(e.message).toContain('fail-2')
  })

  it('EnvironmentRuntimeNotFoundError extends CityRuntimeError', () => {
    const e = new EnvironmentRuntimeNotFoundError('region-1')
    expect(e).toBeInstanceOf(CityRuntimeError)
    expect(e.message).toContain('region-1')
  })

  it('DuplicateOutageError extends CityRuntimeError', () => {
    const e = new DuplicateOutageError('nonce-1')
    expect(e).toBeInstanceOf(CityRuntimeError)
    expect(e.message).toContain('nonce-1')
  })
})

// ── Schema Validation ─────────────────────────────────────────────────────────

describe('registerInfrastructureSchema', () => {
  it('accepts valid infrastructure registration', () => {
    const result = registerInfrastructureSchema.safeParse({
      nodeId:             'power-station-1',
      nodeName:           'Pillbox Power Station',
      infrastructureType: 'power_station',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all valid infrastructure types', () => {
    const types = ['power_station', 'water_treatment', 'gas_main', 'telecom_hub', 'road_segment', 'bridge', 'tunnel', 'sewage', 'other']
    for (const t of types) {
      const r = registerInfrastructureSchema.safeParse({ nodeId: 'n', nodeName: 'N', infrastructureType: t })
      expect(r.success).toBe(true)
    }
  })

  it('rejects unknown infrastructure type', () => {
    const result = registerInfrastructureSchema.safeParse({
      nodeId:             'n-1',
      nodeName:           'Node 1',
      infrastructureType: 'nuclear_plant',
    })
    expect(result.success).toBe(false)
  })
})

describe('reportInfrastructureFailureSchema', () => {
  it('accepts valid failure report', () => {
    const result = reportInfrastructureFailureSchema.safeParse({
      nodeId:       'node-1',
      failureNonce: 'nonce-fail-1',
      failureType:  'power_outage',
      severity:     'high',
      description:  'Main transformer exploded',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all severity levels', () => {
    for (const severity of ['low', 'medium', 'high', 'critical']) {
      const r = reportInfrastructureFailureSchema.safeParse({
        nodeId: 'n-1', failureNonce: 'nonce-1', failureType: 'other', severity,
      })
      expect(r.success).toBe(true)
    }
  })

  it('rejects unknown severity', () => {
    const result = reportInfrastructureFailureSchema.safeParse({
      nodeId: 'n-1', failureNonce: 'nonce-1', failureType: 'other', severity: 'minor',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateTrafficSignalSchema', () => {
  it('accepts valid signal update', () => {
    const result = updateTrafficSignalSchema.safeParse({
      signalId:   'signal-ls-01',
      signalName: 'Pillbox Main & Forum',
      state:      'red',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all valid signal states', () => {
    for (const state of ['green', 'yellow', 'red', 'flashing', 'offline']) {
      const r = updateTrafficSignalSchema.safeParse({ signalId: 's', signalName: 'S', state })
      expect(r.success).toBe(true)
    }
  })

  it('rejects unknown state', () => {
    const result = updateTrafficSignalSchema.safeParse({
      signalId: 's', signalName: 'S', state: 'purple',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateEnvironmentSchema', () => {
  it('accepts full environment update', () => {
    const result = updateEnvironmentSchema.safeParse({
      regionId:           'region-ls',
      weather:            'rain',
      timeOfDay:          'evening',
      temperature:        18.5,
      windSpeed:          35.0,
      visibility:         0.6,
      isEmergencyWeather: false,
    })
    expect(result.success).toBe(true)
  })

  it('accepts partial environment update', () => {
    const result = updateEnvironmentSchema.safeParse({
      regionId: 'region-1',
      weather:  'clear',
    })
    expect(result.success).toBe(true)
  })

  it('accepts null activeEventId', () => {
    const result = updateEnvironmentSchema.safeParse({
      regionId:      'region-1',
      activeEventId: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown weather type', () => {
    const result = updateEnvironmentSchema.safeParse({
      regionId: 'region-1',
      weather:  'apocalypse',
    })
    expect(result.success).toBe(false)
  })
})

describe('recordResourceConsumptionSchema', () => {
  it('accepts valid consumption record', () => {
    const result = recordResourceConsumptionSchema.safeParse({
      gridId:       'grid-power-1',
      resourceType: 'power_kwh',
      amount:       250.5,
      consumerId:   'building-city-hall',
      periodLabel:  '2026-05-20',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all resource types', () => {
    for (const t of ['power_kwh', 'water_liters', 'gas_m3', 'bandwidth_mb']) {
      const r = recordResourceConsumptionSchema.safeParse({ gridId: 'g', resourceType: t, amount: 10 })
      expect(r.success).toBe(true)
    }
  })
})

describe('reportUtilityOutageSchema', () => {
  it('accepts valid outage report', () => {
    const result = reportUtilityOutageSchema.safeParse({
      gridId:       'grid-ls-power',
      gridName:     'Los Santos Power Grid',
      utilityType:  'power',
      outageNonce:  'nonce-outage-1',
      reason:       'Explosion at substation',
      affectedZones: ['zone-downtown', 'zone-pillbox'],
    })
    expect(result.success).toBe(true)
  })

  it('affectedZones is optional', () => {
    const result = reportUtilityOutageSchema.safeParse({
      gridId:      'g-1',
      gridName:    'Grid 1',
      utilityType: 'water',
      outageNonce: 'nonce-1',
      reason:      'pipe burst',
    })
    expect(result.success).toBe(true)
  })
})

describe('restoreUtilityGridSchema', () => {
  it('requires both fields', () => {
    const ok = restoreUtilityGridSchema.safeParse({
      gridId:                 'grid-1',
      restoredByPrincipalId:  'principal-tech',
    })
    expect(ok.success).toBe(true)

    const missing = restoreUtilityGridSchema.safeParse({ gridId: 'grid-1' })
    expect(missing.success).toBe(false)
  })
})
