import { describe, it, expect } from 'vitest'
import {
  TransportRuntimeError,
  VesselNotFoundError,
  VesselAlreadyDockedError,
  AircraftNotFoundError,
  AircraftAlreadyAirborneError,
  FlightNotFoundError,
  DuplicateFlightNonceError,
  AirspaceZoneNotFoundError,
  DockingSlotNotFoundError,
  DuplicateDockingNonceError,
} from '@atc/transport-runtime'
import {
  registerVesselSchema,
  updateVesselPositionSchema,
  dockVesselSchema,
  undockVesselSchema,
  registerAircraftSchema,
  createFlightSchema,
  departFlightSchema,
  landFlightSchema,
  divertFlightSchema,
  registerAirspaceZoneSchema,
  updateAirspaceStatusSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('TransportRuntimeError hierarchy', () => {
  it('VesselNotFoundError extends TransportRuntimeError', () => {
    const e = new VesselNotFoundError('vessel-1')
    expect(e).toBeInstanceOf(TransportRuntimeError)
    expect(e.message).toContain('vessel-1')
    expect(e.name).toBe('VesselNotFoundError')
  })

  it('VesselAlreadyDockedError extends TransportRuntimeError', () => {
    const e = new VesselAlreadyDockedError('vessel-2')
    expect(e).toBeInstanceOf(TransportRuntimeError)
    expect(e.message).toContain('vessel-2')
  })

  it('AircraftNotFoundError extends TransportRuntimeError', () => {
    const e = new AircraftNotFoundError('aircraft-1')
    expect(e).toBeInstanceOf(TransportRuntimeError)
    expect(e.message).toContain('aircraft-1')
  })

  it('AircraftAlreadyAirborneError extends TransportRuntimeError', () => {
    const e = new AircraftAlreadyAirborneError('aircraft-2')
    expect(e).toBeInstanceOf(TransportRuntimeError)
    expect(e.message).toContain('aircraft-2')
  })

  it('FlightNotFoundError extends TransportRuntimeError', () => {
    const e = new FlightNotFoundError('flight-1')
    expect(e).toBeInstanceOf(TransportRuntimeError)
    expect(e.message).toContain('flight-1')
  })

  it('DuplicateFlightNonceError extends TransportRuntimeError', () => {
    const e = new DuplicateFlightNonceError('nonce-abc')
    expect(e).toBeInstanceOf(TransportRuntimeError)
    expect(e.message).toContain('nonce-abc')
  })

  it('AirspaceZoneNotFoundError extends TransportRuntimeError', () => {
    const e = new AirspaceZoneNotFoundError('zone-1')
    expect(e).toBeInstanceOf(TransportRuntimeError)
    expect(e.message).toContain('zone-1')
  })

  it('DockingSlotNotFoundError extends TransportRuntimeError', () => {
    const e = new DockingSlotNotFoundError('slot-1')
    expect(e).toBeInstanceOf(TransportRuntimeError)
    expect(e.message).toContain('slot-1')
  })

  it('DuplicateDockingNonceError extends TransportRuntimeError', () => {
    const e = new DuplicateDockingNonceError('nonce-dock-1')
    expect(e).toBeInstanceOf(TransportRuntimeError)
    expect(e.message).toContain('nonce-dock-1')
  })
})

// ── Schema Validation ─────────────────────────────────────────────────────────

describe('registerVesselSchema', () => {
  it('accepts valid vessel', () => {
    const result = registerVesselSchema.safeParse({
      vesselId:   'vessel-cargo-1',
      vesselName: 'MV Atlantic Star',
      vesselType: 'cargo',
    })
    expect(result.success).toBe(true)
  })

  it('accepts vessel with owner', () => {
    const result = registerVesselSchema.safeParse({
      vesselId:              'vessel-tanker-1',
      vesselName:            'MV Gulf Runner',
      vesselType:            'tanker',
      ownedByPrincipalId:    'principal-company-1',
    })
    expect(result.success).toBe(true)
  })

  it('requires vesselId', () => {
    const result = registerVesselSchema.safeParse({
      vesselName: 'MV Test',
      vesselType: 'cargo',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateVesselPositionSchema', () => {
  it('accepts minimal position', () => {
    const result = updateVesselPositionSchema.safeParse({
      vesselId:  'vessel-1',
      positionX: 100.5,
      positionY: 200.3,
    })
    expect(result.success).toBe(true)
  })

  it('accepts full position', () => {
    const result = updateVesselPositionSchema.safeParse({
      vesselId:   'vessel-1',
      positionX:  100.5,
      positionY:  200.3,
      positionZ:  0.0,
      heading:    180.0,
      speedKnots: 12.5,
      zoneId:     'zone-harbour',
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative speed', () => {
    const result = updateVesselPositionSchema.safeParse({
      vesselId:   'vessel-1',
      positionX:  0,
      positionY:  0,
      speedKnots: -5,
    })
    expect(result.success).toBe(false)
  })
})

describe('dockVesselSchema', () => {
  it('accepts valid docking', () => {
    const result = dockVesselSchema.safeParse({
      dockingNonce: 'nonce-dock-abc',
      vesselId:     'vessel-1',
      dockZoneId:   'zone-port-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts docking with slot', () => {
    const result = dockVesselSchema.safeParse({
      dockingNonce: 'nonce-dock-xyz',
      vesselId:     'vessel-2',
      dockZoneId:   'zone-marina',
      slotId:       'slot-berth-3',
    })
    expect(result.success).toBe(true)
  })

  it('requires dockingNonce', () => {
    const result = dockVesselSchema.safeParse({
      vesselId:   'vessel-1',
      dockZoneId: 'zone-1',
    })
    expect(result.success).toBe(false)
  })
})

describe('undockVesselSchema', () => {
  it('accepts valid undocking', () => {
    const result = undockVesselSchema.safeParse({ dockingId: 'docking-1' })
    expect(result.success).toBe(true)
  })
})

describe('registerAircraftSchema', () => {
  it('accepts valid aircraft', () => {
    const result = registerAircraftSchema.safeParse({
      aircraftId:   'aircraft-chopper-1',
      aircraftName: 'Atlas Heli Alpha',
      aircraftType: 'helicopter',
    })
    expect(result.success).toBe(true)
  })
})

describe('createFlightSchema', () => {
  it('accepts valid flight', () => {
    const result = createFlightSchema.safeParse({
      flightNonce:       'nonce-flight-abc',
      aircraftId:        'aircraft-1',
      originZoneId:      'zone-airport-1',
      destinationZoneId: 'zone-airport-2',
    })
    expect(result.success).toBe(true)
  })

  it('requires flightNonce', () => {
    const result = createFlightSchema.safeParse({
      aircraftId:        'aircraft-1',
      originZoneId:      'zone-1',
      destinationZoneId: 'zone-2',
    })
    expect(result.success).toBe(false)
  })
})

describe('departFlightSchema', () => {
  it('accepts valid depart', () => {
    const result = departFlightSchema.safeParse({ flightId: 'flight-1' })
    expect(result.success).toBe(true)
  })
})

describe('landFlightSchema', () => {
  it('accepts valid land', () => {
    const result = landFlightSchema.safeParse({ flightId: 'flight-1' })
    expect(result.success).toBe(true)
  })
})

describe('divertFlightSchema', () => {
  it('accepts valid divert', () => {
    const result = divertFlightSchema.safeParse({ flightId: 'flight-1' })
    expect(result.success).toBe(true)
  })
})

describe('registerAirspaceZoneSchema', () => {
  it('accepts valid zone', () => {
    const result = registerAirspaceZoneSchema.safeParse({
      zoneId:        'zone-alpha-1',
      zoneName:      'Alpha Restricted Zone',
      zoneType:      'military',
      minAltitudeM:  0,
      maxAltitudeM:  5000,
    })
    expect(result.success).toBe(true)
  })

  it('accepts zone with server id', () => {
    const result = registerAirspaceZoneSchema.safeParse({
      zoneId:         'zone-bravo',
      zoneName:       'Bravo Zone',
      zoneType:       'controlled',
      minAltitudeM:   300,
      maxAltitudeM:   3000,
      ownerServerId:  'server-1',
    })
    expect(result.success).toBe(true)
  })

  it('requires minAltitudeM and maxAltitudeM', () => {
    const result = registerAirspaceZoneSchema.safeParse({
      zoneId:   'zone-1',
      zoneName: 'Test',
      zoneType: 'open',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateAirspaceStatusSchema', () => {
  it('accepts all valid statuses', () => {
    for (const status of ['open', 'restricted', 'closed', 'emergency'] as const) {
      const result = updateAirspaceStatusSchema.safeParse({ zoneId: 'zone-1', status })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid status', () => {
    const result = updateAirspaceStatusSchema.safeParse({ zoneId: 'zone-1', status: 'unknown' })
    expect(result.success).toBe(false)
  })
})
