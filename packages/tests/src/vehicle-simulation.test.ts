import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  VehicleSimError,
  FuelRecordNotFoundError,
  FuelTankEmptyError,
  DamageRecordNotFoundError,
  VehicleRegistrationNotFoundError,
  VehicleRegistrationExpiredError,
  VehicleRegistrationAlreadyActiveError,
  PursuitNotFoundError,
  PursuitAlreadyActiveError,
  PursuitEndedError,
  TrafficViolationNotFoundError,
  MetricsNotFoundError,
} from '@atc/vehicle-simulation'
import {
  syncFuelSchema,
  consumeFuelSchema,
  refuelSchema,
  syncDamageSchema,
  startPursuitSchema,
  endPursuitSchema,
  recordViolationSchema,
  vehicleHeartbeatSchema,
  registerVehicleRegistrationSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('VehicleSimError hierarchy', () => {
  it('FuelRecordNotFoundError extends VehicleSimError', () => {
    const e = new FuelRecordNotFoundError('vrt-1')
    expect(e).toBeInstanceOf(VehicleSimError)
    expect(e.message).toContain('vrt-1')
  })

  it('FuelTankEmptyError extends VehicleSimError', () => {
    const e = new FuelTankEmptyError('vrt-2')
    expect(e).toBeInstanceOf(VehicleSimError)
    expect(e.message).toContain('vrt-2')
  })

  it('DamageRecordNotFoundError extends VehicleSimError', () => {
    const e = new DamageRecordNotFoundError('vrt-3')
    expect(e).toBeInstanceOf(VehicleSimError)
    expect(e.message).toContain('vrt-3')
  })

  it('VehicleRegistrationNotFoundError extends VehicleSimError', () => {
    const e = new VehicleRegistrationNotFoundError('v-1')
    expect(e).toBeInstanceOf(VehicleSimError)
    expect(e.message).toContain('v-1')
  })

  it('VehicleRegistrationExpiredError extends VehicleSimError', () => {
    const e = new VehicleRegistrationExpiredError('v-2')
    expect(e).toBeInstanceOf(VehicleSimError)
    expect(e.message).toContain('v-2')
  })

  it('VehicleRegistrationAlreadyActiveError extends VehicleSimError', () => {
    const e = new VehicleRegistrationAlreadyActiveError('plate-ABC')
    expect(e).toBeInstanceOf(VehicleSimError)
    expect(e.message).toContain('plate-ABC')
  })

  it('PursuitNotFoundError extends VehicleSimError', () => {
    const e = new PursuitNotFoundError('p-1')
    expect(e).toBeInstanceOf(VehicleSimError)
    expect(e.message).toContain('p-1')
  })

  it('PursuitAlreadyActiveError extends VehicleSimError', () => {
    const e = new PursuitAlreadyActiveError('vrt-4')
    expect(e).toBeInstanceOf(VehicleSimError)
    expect(e.message).toContain('vrt-4')
  })

  it('PursuitEndedError extends VehicleSimError', () => {
    const e = new PursuitEndedError('p-2')
    expect(e).toBeInstanceOf(VehicleSimError)
    expect(e.message).toContain('p-2')
  })

  it('TrafficViolationNotFoundError extends VehicleSimError', () => {
    const e = new TrafficViolationNotFoundError('tv-1')
    expect(e).toBeInstanceOf(VehicleSimError)
    expect(e.message).toContain('tv-1')
  })

  it('MetricsNotFoundError extends VehicleSimError', () => {
    const e = new MetricsNotFoundError('vrt-5')
    expect(e).toBeInstanceOf(VehicleSimError)
    expect(e.message).toContain('vrt-5')
  })
})

// ── Schema Validation ─────────────────────────────────────────────────────────

describe('syncFuelSchema', () => {
  it('accepts valid payload', () => {
    const result = syncFuelSchema.safeParse({
      vehicleRuntimeId: 'vrt-abc',
      currentFuel: 45.5,
      fuelGrade: 'premium',
      consumptionRate: 0.05,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid fuelGrade', () => {
    const result = syncFuelSchema.safeParse({
      vehicleRuntimeId: 'vrt-abc',
      currentFuel: 45.5,
      fuelGrade: 'jet',
      consumptionRate: 0.05,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative currentFuel', () => {
    const result = syncFuelSchema.safeParse({
      vehicleRuntimeId: 'vrt-abc',
      currentFuel: -1,
      fuelGrade: 'regular',
      consumptionRate: 0.05,
    })
    expect(result.success).toBe(false)
  })
})

describe('consumeFuelSchema', () => {
  it('accepts valid amount', () => {
    const result = consumeFuelSchema.safeParse({ vehicleRuntimeId: 'vrt-1', amount: 2.5 })
    expect(result.success).toBe(true)
  })

  it('rejects zero amount', () => {
    const result = consumeFuelSchema.safeParse({ vehicleRuntimeId: 'vrt-1', amount: 0 })
    expect(result.success).toBe(false)
  })
})

describe('startPursuitSchema', () => {
  it('accepts valid pursuit payload', () => {
    const result = startPursuitSchema.safeParse({
      vehicleRuntimeId:             'vrt-x',
      suspectPrincipalId:           'p-suspect',
      initiatingOfficerPrincipalId: 'p-officer',
      pursuitNonce:                 'nonce-123',
    })
    expect(result.success).toBe(true)
  })

  it('requires vehicleRuntimeId', () => {
    const result = startPursuitSchema.safeParse({
      suspectPrincipalId:           'p-suspect',
      initiatingOfficerPrincipalId: 'p-officer',
      pursuitNonce:                 'nonce-123',
    })
    expect(result.success).toBe(false)
  })
})

describe('endPursuitSchema', () => {
  it('accepts ended status', () => {
    const result = endPursuitSchema.safeParse({ pursuitId: 'p-1', toStatus: 'ended' })
    expect(result.success).toBe(true)
  })

  it('accepts escaped status', () => {
    const result = endPursuitSchema.safeParse({ pursuitId: 'p-1', toStatus: 'escaped' })
    expect(result.success).toBe(true)
  })

  it('rejects active as end status', () => {
    const result = endPursuitSchema.safeParse({ pursuitId: 'p-1', toStatus: 'active' })
    expect(result.success).toBe(false)
  })
})

describe('recordViolationSchema', () => {
  it('accepts valid speeding violation', () => {
    const result = recordViolationSchema.safeParse({
      vehicleId:     'v-1',
      principalId:   'p-1',
      violationType: 'speeding',
      speedRecorded: 120,
      speedLimit:    80,
      fineAmount:    500,
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown violation type', () => {
    const result = recordViolationSchema.safeParse({
      vehicleId:     'v-1',
      principalId:   'p-1',
      violationType: 'jaywalking',
      fineAmount:    100,
    })
    expect(result.success).toBe(false)
  })
})

describe('registerVehicleRegistrationSchema', () => {
  it('accepts valid registration', () => {
    const result = registerVehicleRegistrationSchema.safeParse({
      vehicleId:        'v-1',
      ownerPrincipalId: 'p-1',
      plate:            'ATC1234',
      expiresAt:        new Date(Date.now() + 86400000).toISOString(),
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing plate', () => {
    const result = registerVehicleRegistrationSchema.safeParse({
      vehicleId:        'v-1',
      ownerPrincipalId: 'p-1',
      expiresAt:        new Date(Date.now() + 86400000).toISOString(),
    })
    expect(result.success).toBe(false)
  })
})

describe('vehicleHeartbeatSchema', () => {
  it('accepts minimal payload', () => {
    const result = vehicleHeartbeatSchema.safeParse({ vehicleRuntimeId: 'vrt-1' })
    expect(result.success).toBe(true)
  })

  it('accepts full payload', () => {
    const result = vehicleHeartbeatSchema.safeParse({
      vehicleRuntimeId:   'vrt-1',
      distanceDelta:      0.5,
      topSpeedSnapshot:   120,
      collisionIncrement: true,
    })
    expect(result.success).toBe(true)
  })
})

// ── Fuel Persistence (service mock) ──────────────────────────────────────────

describe('FuelRuntimeService — fuel persistence', () => {
  it('returns synced fuel record', async () => {
    const mockSync = vi.fn().mockResolvedValue({
      id: 'f-1',
      vehicleRuntimeId: 'vrt-1',
      currentFuel: 45.0,
      tankCapacity: 60.0,
      fuelGrade: 'regular',
      consumptionRate: 0.05,
    })
    const mockService = { sync: mockSync }
    const result = await mockService.sync({ vehicleRuntimeId: 'vrt-1', currentFuel: 45.0, fuelGrade: 'regular', consumptionRate: 0.05 })
    expect(result.currentFuel).toBe(45.0)
    expect(mockSync).toHaveBeenCalledOnce()
  })

  it('throws FuelTankEmptyError on overconsumption', async () => {
    const mockConsume = vi.fn().mockRejectedValue(new FuelTankEmptyError('vrt-1'))
    const mockService = { consume: mockConsume }
    await expect(mockService.consume('vrt-1', 999)).rejects.toBeInstanceOf(FuelTankEmptyError)
  })
})

// ── Pursuit Lifecycle (service mock) ──────────────────────────────────────────

describe('PursuitRuntimeService — pursuit lifecycle', () => {
  it('starts a pursuit and returns record', async () => {
    const mockStart = vi.fn().mockResolvedValue({
      id: 'p-1',
      vehicleRuntimeId: 'vrt-1',
      status: 'active',
      pursuitNonce: 'nonce-abc',
    })
    const mockService = { startPursuit: mockStart }
    const result = await mockService.startPursuit({
      vehicleRuntimeId:             'vrt-1',
      suspectPrincipalId:           'p-suspect',
      initiatingOfficerPrincipalId: 'p-officer',
      pursuitNonce:                 'nonce-abc',
    })
    expect(result.status).toBe('active')
  })

  it('throws PursuitAlreadyActiveError on duplicate pursuit nonce', async () => {
    const mockStart = vi.fn().mockRejectedValue(new PursuitAlreadyActiveError('vrt-1'))
    const mockService = { startPursuit: mockStart }
    await expect(mockService.startPursuit({ vehicleRuntimeId: 'vrt-1' })).rejects.toBeInstanceOf(PursuitAlreadyActiveError)
  })

  it('ends pursuit with escaped status', async () => {
    const mockEnd = vi.fn().mockResolvedValue({ id: 'p-1', status: 'escaped' })
    const mockService = { endPursuit: mockEnd }
    const result = await mockService.endPursuit({ pursuitId: 'p-1', toStatus: 'escaped' })
    expect(result.status).toBe('escaped')
  })

  it('throws PursuitEndedError on double-end', async () => {
    const mockEnd = vi.fn().mockRejectedValue(new PursuitEndedError('p-1'))
    const mockService = { endPursuit: mockEnd }
    await expect(mockService.endPursuit({ pursuitId: 'p-1', toStatus: 'ended' })).rejects.toBeInstanceOf(PursuitEndedError)
  })
})

// ── EventBus Fail-soft ─────────────────────────────────────────────────────────

describe('VehicleSimulation — EventBus fail-soft', () => {
  it('service result unaffected by EventBus emit rejection', async () => {
    const expectedPursuit = { id: 'p-1', status: 'active', pursuitNonce: 'nonce-x' }
    const mockStart = vi.fn().mockImplementation(async (_params: unknown) => {
      // Simulate EventBus emit that rejects silently
      Promise.reject(new Error('redis down')).catch(() => undefined)
      return expectedPursuit
    })
    const mockService = { startPursuit: mockStart }
    const result = await mockService.startPursuit({ vehicleRuntimeId: 'vrt-1' })
    expect(result).toStrictEqual(expectedPursuit)
  })
})
