import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  VehicleError,
  VehicleValidationError,
  VehicleNotFoundError,
  VehicleImmutableError,
  VehicleAlreadySpawnedError,
  VehicleAlreadyStoredError,
  VehicleAlreadyImpoundedError,
  GarageCapacityError,
  GarageVehicleNotFoundError,
  ImpoundNotFoundError,
  EvidenceHoldError,
  FleetAssignmentConflictError,
  FleetAssignmentNotFoundError,
} from '@atc/vehicle-runtime'
import {
  registerVehicleSchema,
  spawnVehicleSchema,
  retrieveVehicleSchema,
  storeVehicleSchema,
  impoundVehicleSchema,
  releaseVehicleSchema,
  syncRuntimeSchema,
  assignFleetSchema,
  unassignFleetSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('VehicleError hierarchy', () => {
  it('VehicleValidationError extends VehicleError', () => {
    const e = new VehicleValidationError('bad input')
    expect(e).toBeInstanceOf(VehicleError)
    expect(e).toBeInstanceOf(VehicleValidationError)
    expect(e.message).toBe('bad input')
  })

  it('VehicleNotFoundError extends VehicleError', () => {
    const e = new VehicleNotFoundError('v1')
    expect(e).toBeInstanceOf(VehicleError)
    expect(e.message).toContain('v1')
  })

  it('VehicleImmutableError extends VehicleError', () => {
    const e = new VehicleImmutableError('v1', 'impounded', 'spawned')
    expect(e).toBeInstanceOf(VehicleError)
    expect(e.message).toContain('impounded')
    expect(e.message).toContain('spawned')
  })

  it('VehicleAlreadySpawnedError extends VehicleError', () => {
    const e = new VehicleAlreadySpawnedError('v1')
    expect(e).toBeInstanceOf(VehicleError)
    expect(e.message).toContain('v1')
  })

  it('VehicleAlreadyStoredError extends VehicleError', () => {
    const e = new VehicleAlreadyStoredError('v1')
    expect(e).toBeInstanceOf(VehicleError)
  })

  it('VehicleAlreadyImpoundedError extends VehicleError', () => {
    const e = new VehicleAlreadyImpoundedError('v1')
    expect(e).toBeInstanceOf(VehicleError)
  })

  it('GarageCapacityError extends VehicleError', () => {
    const e = new GarageCapacityError('g1')
    expect(e).toBeInstanceOf(VehicleError)
  })

  it('GarageVehicleNotFoundError extends VehicleError', () => {
    const e = new GarageVehicleNotFoundError('v1', 'g1')
    expect(e).toBeInstanceOf(VehicleError)
    expect(e.message).toContain('v1')
  })

  it('ImpoundNotFoundError extends VehicleError', () => {
    const e = new ImpoundNotFoundError('v1')
    expect(e).toBeInstanceOf(VehicleError)
  })

  it('EvidenceHoldError extends VehicleError', () => {
    const e = new EvidenceHoldError('v1')
    expect(e).toBeInstanceOf(VehicleError)
  })

  it('FleetAssignmentConflictError extends VehicleError', () => {
    const e = new FleetAssignmentConflictError('v1')
    expect(e).toBeInstanceOf(VehicleError)
  })

  it('FleetAssignmentNotFoundError extends VehicleError', () => {
    const e = new FleetAssignmentNotFoundError('a1')
    expect(e).toBeInstanceOf(VehicleError)
  })
})

// ── Operations Schemas ────────────────────────────────────────────────────────

describe('registerVehicleSchema', () => {
  it('accepts valid payload', () => {
    const result = registerVehicleSchema.safeParse({
      plate: 'ATC-001',
      vin: '1HGCM82633A123456',
      model: 'adder',
      category: 'civilian',
      principalId: 'principal_001',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing plate', () => {
    const result = registerVehicleSchema.safeParse({
      vin: '1HGCM82633A123456',
      model: 'adder',
      principalId: 'principal_001',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid category', () => {
    const result = registerVehicleSchema.safeParse({
      plate: 'ATC-001',
      vin: '1HGCM82633A123456',
      model: 'adder',
      category: 'invalid_category',
      principalId: 'principal_001',
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = registerVehicleSchema.safeParse({
      plate: 'ATC-002',
      vin: 'VIN002',
      model: 'police4',
      category: 'police',
      ownerId: null,
      organizationId: 'org_pd',
      garageId: 'garage_main',
      fuel: 80,
      bodyHealth: 900,
      engineHealth: 950,
      principalId: 'principal_001',
    })
    expect(result.success).toBe(true)
  })
})

describe('spawnVehicleSchema', () => {
  it('accepts valid spawn params', () => {
    const result = spawnVehicleSchema.safeParse({
      spawnedByPrincipalId: 'principal_001',
      x: 100.5,
      y: -200.3,
      z: 10.0,
      heading: 90.0,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing coordinates', () => {
    const result = spawnVehicleSchema.safeParse({
      spawnedByPrincipalId: 'principal_001',
      x: 100.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects fuel out of range', () => {
    const result = spawnVehicleSchema.safeParse({
      spawnedByPrincipalId: 'principal_001',
      x: 0, y: 0, z: 0,
      fuel: 150,
    })
    expect(result.success).toBe(false)
  })
})

describe('impoundVehicleSchema', () => {
  it('accepts valid impound payload', () => {
    const result = impoundVehicleSchema.safeParse({
      impoundedByPrincipalId: 'officer_001',
      reason: 'traffic_stop',
      fee: 500,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid reason', () => {
    const result = impoundVehicleSchema.safeParse({
      impoundedByPrincipalId: 'officer_001',
      reason: 'stolen',
    })
    expect(result.success).toBe(false)
  })

  it('accepts evidence hold with agency', () => {
    const result = impoundVehicleSchema.safeParse({
      impoundedByPrincipalId: 'detective_001',
      reason: 'evidence',
      evidenceHold: true,
      agencyId: 'agency_pd',
      fee: 0,
      notes: 'Crime scene vehicle',
    })
    expect(result.success).toBe(true)
  })
})

describe('syncRuntimeSchema', () => {
  it('accepts full sync payload', () => {
    const result = syncRuntimeSchema.safeParse({
      x: 100.5,
      y: -200.3,
      z: 15.0,
      heading: 45.0,
      fuel: 75,
      bodyHealth: 850,
      engineHealth: 900,
      isLocked: false,
      isEngineOn: true,
      netId: 42,
      serverHandle: 7,
      mileageDelta: 0.5,
    })
    expect(result.success).toBe(true)
  })

  it('requires x y z heading', () => {
    const result = syncRuntimeSchema.safeParse({ x: 0, y: 0 })
    expect(result.success).toBe(false)
  })
})

describe('assignFleetSchema', () => {
  it('accepts org assignment', () => {
    const result = assignFleetSchema.safeParse({
      vehicleId: 'vehicle_001',
      organizationId: 'org_pd',
      assignedByPrincipalId: 'captain_001',
      role: 'patrol',
    })
    expect(result.success).toBe(true)
  })

  it('accepts principal assignment', () => {
    const result = assignFleetSchema.safeParse({
      vehicleId: 'vehicle_002',
      principalId: 'officer_001',
      assignedByPrincipalId: 'sergeant_001',
      expiresInSeconds: 28800,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative expiresInSeconds', () => {
    const result = assignFleetSchema.safeParse({
      vehicleId: 'vehicle_003',
      assignedByPrincipalId: 'captain_001',
      expiresInSeconds: -60,
    })
    expect(result.success).toBe(false)
  })
})

// ── VehicleRuntimeRepository (mocked pool) ───────────────────────────────────

describe('VehicleRuntimeRepository mocked', () => {
  function makeConn(rows: unknown[] = []) {
    return {
      execute: vi.fn().mockResolvedValue([rows, []]),
      release: vi.fn(),
    }
  }

  function makePool(conn: ReturnType<typeof makeConn>) {
    return { getConnection: vi.fn().mockResolvedValue(conn) }
  }

  it('findByVehicle returns null when no rows', async () => {
    const { VehicleRuntimeRepository } = await import('@atc/vehicle-runtime')
    const conn = makeConn([])
    const pool = makePool(conn)
    const repo = new VehicleRuntimeRepository(pool as never)
    const result = await repo.findByVehicle('v_unknown')
    expect(result).toBeNull()
    expect(conn.release).toHaveBeenCalled()
  })

  it('delete calls DELETE query', async () => {
    const { VehicleRuntimeRepository } = await import('@atc/vehicle-runtime')
    const conn = makeConn([])
    const pool = makePool(conn)
    const repo = new VehicleRuntimeRepository(pool as never)
    await repo.delete('v1')
    expect(conn.execute).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM atc_vehicle_runtime'),
      ['v1'],
    )
  })
})

// ── FleetRepository (mocked pool) ────────────────────────────────────────────

describe('FleetRepository mocked', () => {
  function makeConn(queryRows: unknown[][] = []) {
    let callIndex = 0
    return {
      execute: vi.fn().mockImplementation(() => {
        const rows = queryRows[callIndex] ?? []
        callIndex++
        return Promise.resolve([rows, []])
      }),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    }
  }

  function makePool(conn: ReturnType<typeof makeConn>) {
    return { getConnection: vi.fn().mockResolvedValue(conn) }
  }

  it('assign throws FleetAssignmentConflictError when vehicle already assigned', async () => {
    const { FleetRepository } = await import('@atc/vehicle-runtime')
    const existingRow = {
      id: 'a1', vehicle_id: 'v1', organization_id: null, principal_id: 'p1',
      assigned_by_principal_id: 'p2', role: 'general', expires_at: null,
      unassigned_at: null, unassigned_by_principal_id: null,
      assigned_at: new Date(),
    }
    // query 1: SELECT FOR UPDATE → returns existing row
    const conn = makeConn([[existingRow]])
    const pool = makePool(conn)
    const repo = new FleetRepository(pool as never)

    await expect(repo.assign({
      vehicleId: 'v1',
      assignedByPrincipalId: 'admin_001',
    })).rejects.toBeInstanceOf(FleetAssignmentConflictError)

    expect(conn.rollback).toHaveBeenCalled()
  })

  it('findActiveForVehicle returns null when no rows', async () => {
    const { FleetRepository } = await import('@atc/vehicle-runtime')
    const conn = makeConn([[]])
    const pool = makePool(conn)
    const repo = new FleetRepository(pool as never)
    const result = await repo.findActiveForVehicle('v_unknown')
    expect(result).toBeNull()
  })
})

// ── ImpoundRepository (mocked pool) ──────────────────────────────────────────

describe('ImpoundRepository mocked', () => {
  function makeConn(queryRows: unknown[][] = []) {
    let callIndex = 0
    return {
      execute: vi.fn().mockImplementation(() => {
        const rows = queryRows[callIndex] ?? []
        callIndex++
        return Promise.resolve([rows, []])
      }),
      release: vi.fn(),
    }
  }

  function makePool(conn: ReturnType<typeof makeConn>) {
    return { getConnection: vi.fn().mockResolvedValue(conn) }
  }

  it('findActiveForVehicle returns null when no active impound', async () => {
    const { ImpoundRepository } = await import('@atc/vehicle-runtime')
    const conn = makeConn([[]])
    const pool = makePool(conn)
    const repo = new ImpoundRepository(pool as never)
    const result = await repo.findActiveForVehicle('v1')
    expect(result).toBeNull()
  })

  it('release throws EvidenceHoldError for evidence-held impound', async () => {
    const { ImpoundRepository } = await import('@atc/vehicle-runtime')
    const impoundRow = {
      id: 'imp_001', vehicle_id: 'v1', reason: 'evidence',
      impounded_by_principal_id: 'detective_001', agency_id: 'agency_pd',
      location_id: null, evidence_hold: 1, fee: 0, notes: 'Crime scene',
      impounded_at: new Date(), released_at: null,
      released_by_principal_id: null, release_notes: null,
    }
    const conn = makeConn([[impoundRow]])
    const pool = makePool(conn)
    const repo = new ImpoundRepository(pool as never)

    await expect(
      repo.release('v1', 'officer_001'),
    ).rejects.toBeInstanceOf(EvidenceHoldError)
  })
})

// ── GarageRepository (mocked pool) ───────────────────────────────────────────

describe('GarageRepository mocked', () => {
  function makeConn(queryRows: unknown[][] = []) {
    let callIndex = 0
    return {
      execute: vi.fn().mockImplementation(() => {
        const rows = queryRows[callIndex] ?? []
        callIndex++
        return Promise.resolve([rows, []])
      }),
      release: vi.fn(),
    }
  }

  function makePool(conn: ReturnType<typeof makeConn>) {
    return { getConnection: vi.fn().mockResolvedValue(conn) }
  }

  it('findActiveForVehicle returns null when not in garage', async () => {
    const { GarageRepository } = await import('@atc/vehicle-runtime')
    const conn = makeConn([[]])
    const pool = makePool(conn)
    const repo = new GarageRepository(pool as never)
    const result = await repo.findActiveForVehicle('v1')
    expect(result).toBeNull()
  })

  it('listGarages maps aggregation result', async () => {
    const { GarageRepository } = await import('@atc/vehicle-runtime')
    const aggRows = [
      { garage_id: 'garage_downtown', cnt: 5 },
      { garage_id: 'garage_airport', cnt: 3 },
    ]
    const conn = makeConn([aggRows])
    const pool = makePool(conn)
    const repo = new GarageRepository(pool as never)
    const result = await repo.listGarages()
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ garageId: 'garage_downtown', vehicleCount: 5 })
    expect(result[1]).toEqual({ garageId: 'garage_airport', vehicleCount: 3 })
  })
})

// ── VehicleRuntimeService orchestration (mocked deps) ────────────────────────

describe('VehicleRuntimeService orchestration', () => {
  function makeMockVehicleRepo() {
    return {
      findById: vi.fn(),
      create: vi.fn(),
      transition: vi.fn(),
      updateRuntimeSnapshot: vi.fn(),
      findByPlate: vi.fn(),
      findByVin: vi.fn(),
      listByOwner: vi.fn().mockResolvedValue([]),
      listByOrganization: vi.fn().mockResolvedValue([]),
      listByGarage: vi.fn().mockResolvedValue([]),
    }
  }

  function makeMockRuntimeRepo() {
    return {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      findByVehicle: vi.fn().mockResolvedValue(null),
      listActive: vi.fn().mockResolvedValue([]),
    }
  }

  function makeMockGarageRepo() {
    return {
      store: vi.fn(),
      retrieve: vi.fn(),
      findActiveForVehicle: vi.fn().mockResolvedValue(null),
      listActiveByGarage: vi.fn().mockResolvedValue([]),
      listGarages: vi.fn().mockResolvedValue([]),
    }
  }

  function makeMockImpoundRepo() {
    return {
      create: vi.fn(),
      release: vi.fn(),
      findActiveForVehicle: vi.fn().mockResolvedValue(null),
      listByVehicle: vi.fn().mockResolvedValue([]),
    }
  }

  function makeMockPool() {
    const conn = {
      execute: vi.fn().mockResolvedValue([[{ status: 'stored' }], []]),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    }
    return {
      pool: { getConnection: vi.fn().mockResolvedValue(conn) },
      conn,
    }
  }

  it('findById returns null for unknown vehicle', async () => {
    const { VehicleRuntimeService } = await import('@atc/vehicle-runtime')
    const vehicleRepo = makeMockVehicleRepo()
    vehicleRepo.findById.mockResolvedValue(null)
    const { pool } = makeMockPool()
    const svc = new VehicleRuntimeService({
      vehicleRepo: vehicleRepo as never,
      runtimeRepo: makeMockRuntimeRepo() as never,
      garageRepo: makeMockGarageRepo() as never,
      impoundRepo: makeMockImpoundRepo() as never,
      pool: pool as never,
      eventBus: undefined,
    })
    const result = await svc.findById('unknown')
    expect(result).toBeNull()
  })

  it('registerVehicle delegates to vehicleRepo.create', async () => {
    const { VehicleRuntimeService } = await import('@atc/vehicle-runtime')
    const vehicleRepo = makeMockVehicleRepo()
    const fakeVehicle = { id: 'v1', plate: 'ATC-001' }
    vehicleRepo.create.mockResolvedValue(fakeVehicle)
    const { pool } = makeMockPool()
    const svc = new VehicleRuntimeService({
      vehicleRepo: vehicleRepo as never,
      runtimeRepo: makeMockRuntimeRepo() as never,
      garageRepo: makeMockGarageRepo() as never,
      impoundRepo: makeMockImpoundRepo() as never,
      pool: pool as never,
      eventBus: undefined,
    })
    const result = await svc.registerVehicle({ plate: 'ATC-001', vin: 'VIN1', model: 'adder' } as never)
    expect(result).toBe(fakeVehicle)
    expect(vehicleRepo.create).toHaveBeenCalledTimes(1)
  })

  it('listByOwner delegates to vehicleRepo.listByOwner', async () => {
    const { VehicleRuntimeService } = await import('@atc/vehicle-runtime')
    const vehicleRepo = makeMockVehicleRepo()
    vehicleRepo.listByOwner.mockResolvedValue([{ id: 'v1' }, { id: 'v2' }])
    const { pool } = makeMockPool()
    const svc = new VehicleRuntimeService({
      vehicleRepo: vehicleRepo as never,
      runtimeRepo: makeMockRuntimeRepo() as never,
      garageRepo: makeMockGarageRepo() as never,
      impoundRepo: makeMockImpoundRepo() as never,
      pool: pool as never,
      eventBus: undefined,
    })
    const result = await svc.listByOwner('owner_001')
    expect(result).toHaveLength(2)
    expect(vehicleRepo.listByOwner).toHaveBeenCalledWith('owner_001')
  })

  it('syncRuntime calls both runtimeRepo.update and vehicleRepo.updateRuntimeSnapshot', async () => {
    const { VehicleRuntimeService } = await import('@atc/vehicle-runtime')
    const vehicleRepo = makeMockVehicleRepo()
    vehicleRepo.updateRuntimeSnapshot.mockResolvedValue(undefined)
    const runtimeRepo = makeMockRuntimeRepo()
    const { pool } = makeMockPool()
    const svc = new VehicleRuntimeService({
      vehicleRepo: vehicleRepo as never,
      runtimeRepo: runtimeRepo as never,
      garageRepo: makeMockGarageRepo() as never,
      impoundRepo: makeMockImpoundRepo() as never,
      pool: pool as never,
      eventBus: undefined,
    })
    await svc.syncRuntime('v1', { x: 1, y: 2, z: 3, heading: 0 })
    expect(runtimeRepo.update).toHaveBeenCalledTimes(1)
    expect(vehicleRepo.updateRuntimeSnapshot).toHaveBeenCalledTimes(1)
  })
})

// ── FleetService ──────────────────────────────────────────────────────────────

describe('FleetService', () => {
  it('assign emits FLEET_ASSIGNED event', async () => {
    const { FleetService } = await import('@atc/vehicle-runtime')
    const mockAssignment = {
      id: 'a1', vehicleId: 'v1', organizationId: 'org_pd', principalId: null,
      assignedByPrincipalId: 'captain_001', role: 'patrol',
      expiresAt: null, unassignedAt: null, unassignedByPrincipalId: null, assignedAt: new Date(),
    }
    const fleetRepo = { assign: vi.fn().mockResolvedValue(mockAssignment) }
    const eventBus = { emit: vi.fn().mockResolvedValue(undefined) }
    const svc = new FleetService({ fleetRepo: fleetRepo as never, eventBus: eventBus as never })
    const result = await svc.assign({
      vehicleId: 'v1',
      organizationId: 'org_pd',
      assignedByPrincipalId: 'captain_001',
    })
    expect(result).toBe(mockAssignment)
    expect(eventBus.emit).toHaveBeenCalledWith('atc:vehicle:fleet:assigned', expect.objectContaining({
      vehicleId: 'v1',
    }))
  })

  it('unassign emits FLEET_UNASSIGNED event', async () => {
    const { FleetService } = await import('@atc/vehicle-runtime')
    const mockAssignment = {
      id: 'a1', vehicleId: 'v1', organizationId: 'org_pd', principalId: null,
      assignedByPrincipalId: 'captain_001', role: 'patrol',
      expiresAt: null, unassignedAt: new Date(), unassignedByPrincipalId: 'captain_001', assignedAt: new Date(),
    }
    const fleetRepo = { unassign: vi.fn().mockResolvedValue(mockAssignment) }
    const eventBus = { emit: vi.fn().mockResolvedValue(undefined) }
    const svc = new FleetService({ fleetRepo: fleetRepo as never, eventBus: eventBus as never })
    await svc.unassign('a1', 'captain_001')
    expect(eventBus.emit).toHaveBeenCalledWith('atc:vehicle:fleet:unassigned', expect.objectContaining({
      assignmentId: 'a1',
    }))
  })
})

// ── GarageService ─────────────────────────────────────────────────────────────

describe('GarageService', () => {
  it('listGarages delegates to garageRepo', async () => {
    const { GarageService } = await import('@atc/vehicle-runtime')
    const garageRepo = {
      listGarages: vi.fn().mockResolvedValue([
        { garageId: 'garage_downtown', vehicleCount: 3 },
      ]),
      listActiveByGarage: vi.fn(),
      findActiveForVehicle: vi.fn(),
    }
    const svc = new GarageService({ garageRepo: garageRepo as never })
    const result = await svc.listGarages()
    expect(result).toHaveLength(1)
    expect(result[0]?.garageId).toBe('garage_downtown')
  })

  it('listVehicles delegates to garageRepo.listActiveByGarage', async () => {
    const { GarageService } = await import('@atc/vehicle-runtime')
    const garageRepo = {
      listGarages: vi.fn(),
      listActiveByGarage: vi.fn().mockResolvedValue([{ id: 'gr1' }, { id: 'gr2' }]),
      findActiveForVehicle: vi.fn(),
    }
    const svc = new GarageService({ garageRepo: garageRepo as never })
    const result = await svc.listVehicles('garage_downtown')
    expect(result).toHaveLength(2)
    expect(garageRepo.listActiveByGarage).toHaveBeenCalledWith('garage_downtown')
  })
})

// ── ImpoundService ────────────────────────────────────────────────────────────

describe('ImpoundService', () => {
  it('getActiveImpound returns null when none', async () => {
    const { ImpoundService } = await import('@atc/vehicle-runtime')
    const impoundRepo = {
      findActiveForVehicle: vi.fn().mockResolvedValue(null),
      listByVehicle: vi.fn(),
    }
    const svc = new ImpoundService({ impoundRepo: impoundRepo as never })
    const result = await svc.getActiveImpound('v1')
    expect(result).toBeNull()
  })

  it('listByVehicle returns history', async () => {
    const { ImpoundService } = await import('@atc/vehicle-runtime')
    const impoundRepo = {
      findActiveForVehicle: vi.fn(),
      listByVehicle: vi.fn().mockResolvedValue([{ id: 'imp_001' }, { id: 'imp_002' }]),
    }
    const svc = new ImpoundService({ impoundRepo: impoundRepo as never })
    const result = await svc.listByVehicle('v1')
    expect(result).toHaveLength(2)
  })
})
