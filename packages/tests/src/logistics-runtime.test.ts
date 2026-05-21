import { describe, it, expect } from 'vitest'
import {
  LogisticsRuntimeError,
  ShipmentNotFoundError,
  ShipmentAlreadyInTransitError,
  ShipmentAlreadyDeliveredError,
  DuplicateShipmentNonceError,
  SupplyRouteNotFoundError,
  LogisticsFleetNotFoundError,
  FleetAlreadyDeployedError,
  SupplyChainNotFoundError,
  CargoNotFoundError,
} from '@atc/logistics-runtime'
import {
  createShipmentSchema,
  departShipmentSchema,
  deliverShipmentSchema,
  failShipmentSchema,
  registerSupplyRouteSchema,
  registerLogisticsFleetSchema,
  assignLogisticsFleetSchema,
  upsertSupplyChainSchema,
  disruptSupplyChainSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('LogisticsRuntimeError hierarchy', () => {
  it('ShipmentNotFoundError extends LogisticsRuntimeError', () => {
    const e = new ShipmentNotFoundError('ship-1')
    expect(e).toBeInstanceOf(LogisticsRuntimeError)
    expect(e.message).toContain('ship-1')
    expect(e.name).toBe('ShipmentNotFoundError')
  })

  it('ShipmentAlreadyInTransitError extends LogisticsRuntimeError', () => {
    const e = new ShipmentAlreadyInTransitError('ship-2')
    expect(e).toBeInstanceOf(LogisticsRuntimeError)
    expect(e.message).toContain('ship-2')
  })

  it('ShipmentAlreadyDeliveredError extends LogisticsRuntimeError', () => {
    const e = new ShipmentAlreadyDeliveredError('ship-3')
    expect(e).toBeInstanceOf(LogisticsRuntimeError)
    expect(e.message).toContain('ship-3')
  })

  it('DuplicateShipmentNonceError extends LogisticsRuntimeError', () => {
    const e = new DuplicateShipmentNonceError('nonce-1')
    expect(e).toBeInstanceOf(LogisticsRuntimeError)
    expect(e.message).toContain('nonce-1')
  })

  it('SupplyRouteNotFoundError extends LogisticsRuntimeError', () => {
    const e = new SupplyRouteNotFoundError('route-1')
    expect(e).toBeInstanceOf(LogisticsRuntimeError)
    expect(e.message).toContain('route-1')
  })

  it('LogisticsFleetNotFoundError extends LogisticsRuntimeError', () => {
    const e = new LogisticsFleetNotFoundError('fleet-1')
    expect(e).toBeInstanceOf(LogisticsRuntimeError)
    expect(e.message).toContain('fleet-1')
  })

  it('FleetAlreadyDeployedError extends LogisticsRuntimeError', () => {
    const e = new FleetAlreadyDeployedError('fleet-2')
    expect(e).toBeInstanceOf(LogisticsRuntimeError)
    expect(e.message).toContain('fleet-2')
  })

  it('SupplyChainNotFoundError extends LogisticsRuntimeError', () => {
    const e = new SupplyChainNotFoundError('chain-1')
    expect(e).toBeInstanceOf(LogisticsRuntimeError)
    expect(e.message).toContain('chain-1')
  })

  it('CargoNotFoundError extends LogisticsRuntimeError', () => {
    const e = new CargoNotFoundError('cargo-1')
    expect(e).toBeInstanceOf(LogisticsRuntimeError)
    expect(e.message).toContain('cargo-1')
  })
})

// ── Schema Validation ─────────────────────────────────────────────────────────

describe('createShipmentSchema', () => {
  it('accepts valid shipment', () => {
    const result = createShipmentSchema.safeParse({
      shipmentNonce: 'nonce-ship-abc',
      originId:      'node-warehouse-1',
      destinationId: 'node-shop-downtown',
    })
    expect(result.success).toBe(true)
  })

  it('accepts shipment with all optional fields', () => {
    const result = createShipmentSchema.safeParse({
      shipmentNonce:       'nonce-ship-xyz',
      originId:            'node-port',
      destinationId:       'node-depot',
      carrierPrincipalId:  'principal-carrier-1',
      cargoManifest:       ['item-box-1', 'item-crate-2'],
    })
    expect(result.success).toBe(true)
  })

  it('requires shipmentNonce', () => {
    const result = createShipmentSchema.safeParse({
      originId:      'node-1',
      destinationId: 'node-2',
    })
    expect(result.success).toBe(false)
  })
})

describe('departShipmentSchema', () => {
  it('accepts valid depart', () => {
    const result = departShipmentSchema.safeParse({ shipmentId: 'ship-1' })
    expect(result.success).toBe(true)
  })
})

describe('deliverShipmentSchema', () => {
  it('accepts valid delivery', () => {
    const result = deliverShipmentSchema.safeParse({ shipmentId: 'ship-1' })
    expect(result.success).toBe(true)
  })
})

describe('failShipmentSchema', () => {
  it('accepts valid failure with reason', () => {
    const result = failShipmentSchema.safeParse({
      shipmentId: 'ship-1',
      reason:     'Vehicle breakdown en route',
    })
    expect(result.success).toBe(true)
  })

  it('requires reason', () => {
    const result = failShipmentSchema.safeParse({ shipmentId: 'ship-1' })
    expect(result.success).toBe(false)
  })
})

describe('registerSupplyRouteSchema', () => {
  it('accepts valid route', () => {
    const result = registerSupplyRouteSchema.safeParse({
      routeId:                   'route-north-1',
      routeName:                 'Northern Trade Route',
      originNodeId:              'node-port-north',
      destinationNodeId:         'node-depot-central',
      routeType:                 'ground',
      distanceKm:                150.5,
      estimatedDurationMinutes:  180,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid route type', () => {
    const result = registerSupplyRouteSchema.safeParse({
      routeId:                  'route-1',
      routeName:                'Test Route',
      originNodeId:             'node-1',
      destinationNodeId:        'node-2',
      routeType:                'boat',
      distanceKm:               50,
      estimatedDurationMinutes: 60,
    })
    expect(result.success).toBe(false)
  })

  it('accepts all route types', () => {
    for (const routeType of ['ground', 'air', 'sea', 'rail'] as const) {
      const result = registerSupplyRouteSchema.safeParse({
        routeId:                  `route-${routeType}`,
        routeName:                `${routeType} route`,
        originNodeId:             'node-1',
        destinationNodeId:        'node-2',
        routeType,
        distanceKm:               100,
        estimatedDurationMinutes: 120,
      })
      expect(result.success).toBe(true)
    }
  })
})

describe('registerLogisticsFleetSchema', () => {
  it('accepts valid fleet', () => {
    const result = registerLogisticsFleetSchema.safeParse({
      fleetId:          'fleet-alpha',
      fleetName:        'Alpha Transport Fleet',
      ownerPrincipalId: 'principal-company-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts fleet with vehicle ids', () => {
    const result = registerLogisticsFleetSchema.safeParse({
      fleetId:          'fleet-beta',
      fleetName:        'Beta Fleet',
      ownerPrincipalId: 'principal-1',
      vehicleIds:       ['vehicle-truck-1', 'vehicle-van-2'],
    })
    expect(result.success).toBe(true)
  })
})

describe('assignLogisticsFleetSchema', () => {
  it('accepts valid assignment', () => {
    const result = assignLogisticsFleetSchema.safeParse({
      fleetId: 'fleet-alpha',
      routeId: 'route-north-1',
    })
    expect(result.success).toBe(true)
  })
})

describe('upsertSupplyChainSchema', () => {
  it('accepts valid supply chain', () => {
    const result = upsertSupplyChainSchema.safeParse({
      chainId:   'chain-main',
      chainName: 'Main Supply Chain',
      nodes:     ['node-1', 'node-2', 'node-3'],
      edges:     [{ from: 'node-1', to: 'node-2' }, { from: 'node-2', to: 'node-3' }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty supply chain', () => {
    const result = upsertSupplyChainSchema.safeParse({
      chainId:   'chain-empty',
      chainName: 'Empty Chain',
      nodes:     [],
      edges:     [],
    })
    expect(result.success).toBe(true)
  })
})

describe('disruptSupplyChainSchema', () => {
  it('accepts valid disruption', () => {
    const result = disruptSupplyChainSchema.safeParse({ chainId: 'chain-main' })
    expect(result.success).toBe(true)
  })
})
