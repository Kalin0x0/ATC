import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  PropertyError,
  PropertyValidationError,
  PropertyNotFoundError,
  PropertyImmutableError,
  PropertyAlreadyOwnedError,
  PropertyAccessDeniedError,
  PropertyAccessNotFoundError,
  PropertyKeyNotFoundError,
  PropertyKeyAlreadyIssuedError,
  PropertyAccessConflictError,
  StashNotFoundError,
  StashCapacityError,
  StashItemNotFoundError,
  StashInsufficientQuantityError,
  PropertyGarageNotFoundError,
  PropertyGarageAlreadyLinkedError,
  EmergencyAccessError,
  PropertyRuntimeNotFoundError,
} from '@atc/property-runtime'
import {
  registerPropertySchema,
  purchasePropertySchema,
  breachPropertySchema,
  grantAccessSchema,
  depositStorageSchema,
  withdrawStorageSchema,
  linkGarageSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('PropertyError hierarchy', () => {
  it('PropertyValidationError extends PropertyError', () => {
    const e = new PropertyValidationError('bad input')
    expect(e).toBeInstanceOf(PropertyError)
    expect(e.message).toBe('bad input')
  })

  it('PropertyNotFoundError extends PropertyError', () => {
    const e = new PropertyNotFoundError('p1')
    expect(e).toBeInstanceOf(PropertyError)
    expect(e.message).toContain('p1')
  })

  it('PropertyImmutableError includes from/to states', () => {
    const e = new PropertyImmutableError('p1', 'available', 'breached')
    expect(e).toBeInstanceOf(PropertyError)
    expect(e.message).toContain('available')
    expect(e.message).toContain('breached')
  })

  it('PropertyAlreadyOwnedError extends PropertyError', () => {
    const e = new PropertyAlreadyOwnedError('p1')
    expect(e).toBeInstanceOf(PropertyError)
  })

  it('PropertyAccessConflictError extends PropertyError', () => {
    const e = new PropertyAccessConflictError('p1', 'principal_001', 'tenant')
    expect(e).toBeInstanceOf(PropertyError)
    expect(e.message).toContain('tenant')
  })

  it('PropertyKeyAlreadyIssuedError extends PropertyError', () => {
    const e = new PropertyKeyAlreadyIssuedError('p1', 'principal_001')
    expect(e).toBeInstanceOf(PropertyError)
  })

  it('StashCapacityError extends PropertyError', () => {
    const e = new StashCapacityError('stash_001', 50)
    expect(e).toBeInstanceOf(PropertyError)
    expect(e.message).toContain('50')
  })

  it('StashInsufficientQuantityError extends PropertyError', () => {
    const e = new StashInsufficientQuantityError('water_bottle', 5, 2)
    expect(e).toBeInstanceOf(PropertyError)
    expect(e.message).toContain('5')
    expect(e.message).toContain('2')
  })

  it('PropertyGarageAlreadyLinkedError extends PropertyError', () => {
    const e = new PropertyGarageAlreadyLinkedError('p1', 'g1')
    expect(e).toBeInstanceOf(PropertyError)
  })

  it('EmergencyAccessError extends PropertyError', () => {
    const e = new EmergencyAccessError('Cannot breach')
    expect(e).toBeInstanceOf(PropertyError)
  })
})

// ── Operations Schemas ────────────────────────────────────────────────────────

describe('registerPropertySchema', () => {
  it('accepts valid payload', () => {
    const result = registerPropertySchema.safeParse({
      name:         'Apartment 4B',
      address:      '22 Vinewood Hills',
      interiorType: 'high_end_apartment',
      principalId:  'admin_001',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing name', () => {
    const result = registerPropertySchema.safeParse({
      address:      '22 Vinewood Hills',
      interiorType: 'apartment',
      principalId:  'admin_001',
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional owner and organization', () => {
    const result = registerPropertySchema.safeParse({
      name:           'Police HQ',
      address:        '1 Mission Row',
      interiorType:   'government',
      ownerId:        null,
      organizationId: 'org_pd',
      storageCapacity: 200,
      principalId:    'admin_001',
    })
    expect(result.success).toBe(true)
  })
})

describe('purchasePropertySchema', () => {
  it('accepts buyer principal', () => {
    const result = purchasePropertySchema.safeParse({
      buyerPrincipalId: 'player_001',
    })
    expect(result.success).toBe(true)
  })

  it('accepts with organization', () => {
    const result = purchasePropertySchema.safeParse({
      buyerPrincipalId: 'player_001',
      organizationId:   'org_pd',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing buyer', () => {
    const result = purchasePropertySchema.safeParse({ organizationId: 'org_pd' })
    expect(result.success).toBe(false)
  })
})

describe('breachPropertySchema', () => {
  it('accepts law enforcement breach', () => {
    const result = breachPropertySchema.safeParse({
      breachingPrincipalId: 'officer_001',
      accessType:           'emergency_law',
      reason:               'Warrant execution',
      agencyId:             'agency_pd',
    })
    expect(result.success).toBe(true)
  })

  it('accepts EMS breach', () => {
    const result = breachPropertySchema.safeParse({
      breachingPrincipalId: 'medic_001',
      accessType:           'emergency_ems',
      reason:               'Unresponsive patient inside',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid access type', () => {
    const result = breachPropertySchema.safeParse({
      breachingPrincipalId: 'player_001',
      accessType:           'owner',
      reason:               'I live here',
    })
    expect(result.success).toBe(false)
  })
})

describe('grantAccessSchema', () => {
  it('accepts guest access with expiry', () => {
    const result = grantAccessSchema.safeParse({
      principalId:          'guest_001',
      accessType:           'guest',
      grantedByPrincipalId: 'owner_001',
      expiresInSeconds:     3600,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative expiresInSeconds', () => {
    const result = grantAccessSchema.safeParse({
      principalId:          'guest_001',
      accessType:           'guest',
      grantedByPrincipalId: 'owner_001',
      expiresInSeconds:     -1,
    })
    expect(result.success).toBe(false)
  })
})

describe('depositStorageSchema', () => {
  it('accepts valid deposit', () => {
    const result = depositStorageSchema.safeParse({
      stashId:            'main_stash',
      itemName:           'water_bottle',
      quantity:           5,
      addedByPrincipalId: 'player_001',
    })
    expect(result.success).toBe(true)
  })

  it('rejects zero quantity', () => {
    const result = depositStorageSchema.safeParse({
      stashId:            'main_stash',
      itemName:           'water_bottle',
      quantity:           0,
      addedByPrincipalId: 'player_001',
    })
    expect(result.success).toBe(false)
  })
})

// ── PropertyRepository (mocked pool) ─────────────────────────────────────────

describe('PropertyRepository mocked', () => {
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

  it('findById returns null when not found', async () => {
    const { PropertyRepository } = await import('@atc/property-runtime')
    const conn = makeConn([[]])
    const pool = makePool(conn)
    const repo = new PropertyRepository(pool as never)
    const result = await repo.findById('p_unknown')
    expect(result).toBeNull()
    expect(conn.release).toHaveBeenCalled()
  })

  it('listByOwner returns mapped properties', async () => {
    const { PropertyRepository } = await import('@atc/property-runtime')
    const fakeRow = {
      id: 'p1', owner_id: 'owner_001', organization_id: null,
      name: 'Apartment 4B', address: '22 Vinewood', interior_type: 'apartment',
      shell_id: null, status: 'owned', is_locked: 0, alarm_state: 'off',
      storage_capacity: 100, notes: null, seized_by_principal_id: null,
      seized_at: null, created_at: new Date(), updated_at: new Date(),
    }
    const conn = makeConn([[fakeRow]])
    const pool = makePool(conn)
    const repo = new PropertyRepository(pool as never)
    const result = await repo.listByOwner('owner_001')
    expect(result).toHaveLength(1)
    expect(result[0]?.status).toBe('owned')
    expect(result[0]?.isLocked).toBe(false)
  })

  it('transition rejects invalid state change', async () => {
    const { PropertyRepository } = await import('@atc/property-runtime')
    const fakeRow = {
      id: 'p1', owner_id: 'owner_001', organization_id: null,
      name: 'Apt', address: '1 Main St', interior_type: 'apartment',
      shell_id: null, status: 'available', is_locked: 0, alarm_state: 'off',
      storage_capacity: 100, notes: null, seized_by_principal_id: null,
      seized_at: null, created_at: new Date(), updated_at: new Date(),
    }
    // SELECT FOR UPDATE returns available property
    // After that, INSERT/UPDATE won't matter — error thrown before it
    const conn = makeConn([[fakeRow], [], []])
    const pool = makePool(conn)
    const repo = new PropertyRepository(pool as never)

    await expect(repo.transition({ id: 'p1', newStatus: 'breached' }))
      .rejects.toBeInstanceOf(PropertyImmutableError)

    expect(conn.rollback).toHaveBeenCalled()
  })
})

// ── PropertyAccessRepository (mocked pool) ────────────────────────────────────

describe('PropertyAccessRepository mocked', () => {
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

  it('grant throws PropertyAccessConflictError when duplicate active grant', async () => {
    const { PropertyAccessRepository } = await import('@atc/property-runtime')
    const existingAccess = { id: 'a1' }
    // SELECT FOR UPDATE returns existing — should throw conflict
    const conn = makeConn([[existingAccess]])
    const pool = makePool(conn)
    const repo = new PropertyAccessRepository(pool as never)

    await expect(repo.grant({
      propertyId: 'p1',
      principalId: 'principal_001',
      accessType: 'tenant',
      grantedByPrincipalId: 'owner_001',
    })).rejects.toBeInstanceOf(PropertyAccessConflictError)

    expect(conn.rollback).toHaveBeenCalled()
  })

  it('findActiveForPrincipal returns empty when no grants', async () => {
    const { PropertyAccessRepository } = await import('@atc/property-runtime')
    const conn = makeConn([[]])
    const pool = makePool(conn)
    const repo = new PropertyAccessRepository(pool as never)
    const result = await repo.findActiveForPrincipal('p1', 'principal_001')
    expect(result).toHaveLength(0)
  })

  it('issueKey throws PropertyKeyAlreadyIssuedError when key exists', async () => {
    const { PropertyAccessRepository } = await import('@atc/property-runtime')
    const existingKey = { id: 'k1' }
    const conn = makeConn([[existingKey]])
    const pool = makePool(conn)
    const repo = new PropertyAccessRepository(pool as never)

    await expect(repo.issueKey('p1', 'principal_001', 'owner_001'))
      .rejects.toBeInstanceOf(PropertyKeyAlreadyIssuedError)

    expect(conn.rollback).toHaveBeenCalled()
  })
})

// ── PropertyStashRepository (mocked pool) ─────────────────────────────────────

describe('PropertyStashRepository mocked', () => {
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

  it('deposit throws StashCapacityError when at capacity', async () => {
    const { PropertyStashRepository } = await import('@atc/property-runtime')
    const stashRow = {
      id: 's1', property_id: 'p1', stash_id: 'main_stash',
      label: 'Main Stash', stash_type: 'personal',
      owner_id: 'owner_001', organization_id: null,
      capacity: 2, is_locked: 0,
      created_at: new Date(), updated_at: new Date(),
    }
    const countRow = { cnt: 2 } // at capacity
    // Query sequence: SELECT stash FOR UPDATE, SELECT COUNT, SELECT existing item
    const conn = makeConn([[stashRow], [countRow], []])
    const pool = makePool(conn)
    const repo = new PropertyStashRepository(pool as never)

    await expect(repo.deposit('s1', 'new_item', 1, null, 'player_001'))
      .rejects.toBeInstanceOf(StashCapacityError)

    expect(conn.rollback).toHaveBeenCalled()
  })

  it('withdraw throws StashItemNotFoundError when item missing', async () => {
    const { PropertyStashRepository } = await import('@atc/property-runtime')
    const stashRow = { id: 's1' }
    // Stash found, item not found
    const conn = makeConn([[stashRow], [], []])
    const pool = makePool(conn)
    const repo = new PropertyStashRepository(pool as never)

    await expect(repo.withdraw('s1', 'missing_item', 1, 'player_001'))
      .rejects.toBeInstanceOf(StashItemNotFoundError)

    expect(conn.rollback).toHaveBeenCalled()
  })

  it('withdraw throws StashInsufficientQuantityError when quantity too low', async () => {
    const { PropertyStashRepository } = await import('@atc/property-runtime')
    const stashRow = { id: 's1' }
    const itemRow = {
      id: 'i1', stash_record_id: 's1', item_name: 'water_bottle',
      quantity: 2, metadata: null, added_by_principal_id: 'player_001', added_at: new Date(),
    }
    const conn = makeConn([[stashRow], [itemRow]])
    const pool = makePool(conn)
    const repo = new PropertyStashRepository(pool as never)

    await expect(repo.withdraw('s1', 'water_bottle', 5, 'player_001'))
      .rejects.toBeInstanceOf(StashInsufficientQuantityError)

    expect(conn.rollback).toHaveBeenCalled()
  })

  it('getContents returns empty list for empty stash', async () => {
    const { PropertyStashRepository } = await import('@atc/property-runtime')
    const conn = makeConn([[]])
    const pool = makePool(conn)
    const repo = new PropertyStashRepository(pool as never)
    const result = await repo.getContents('s1')
    expect(result).toHaveLength(0)
  })
})

// ── PropertyGarageRepository (mocked pool) ────────────────────────────────────

describe('PropertyGarageRepository mocked', () => {
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

  it('link throws PropertyGarageAlreadyLinkedError when already linked', async () => {
    const { PropertyGarageRepository } = await import('@atc/property-runtime')
    const existingLink = { id: 'pg1' }
    const conn = makeConn([[existingLink]])
    const pool = makePool(conn)
    const repo = new PropertyGarageRepository(pool as never)

    await expect(repo.link('p1', 'g1', 'owner_001'))
      .rejects.toBeInstanceOf(PropertyGarageAlreadyLinkedError)

    expect(conn.rollback).toHaveBeenCalled()
  })

  it('findActive returns null when no link', async () => {
    const { PropertyGarageRepository } = await import('@atc/property-runtime')
    const conn = makeConn([[]])
    const pool = makePool(conn)
    const repo = new PropertyGarageRepository(pool as never)
    const result = await repo.findActive('p1', 'g1')
    expect(result).toBeNull()
  })

  it('listActiveForProperty returns mapped records', async () => {
    const { PropertyGarageRepository } = await import('@atc/property-runtime')
    const garageRow = {
      id: 'pg1', property_id: 'p1', garage_id: 'g1',
      label: 'Main Garage', capacity: 4,
      linked_by_principal_id: 'owner_001', linked_at: new Date(),
      unlinked_at: null, unlinked_by_principal_id: null,
    }
    const conn = makeConn([[garageRow]])
    const pool = makePool(conn)
    const repo = new PropertyGarageRepository(pool as never)
    const result = await repo.listActiveForProperty('p1')
    expect(result).toHaveLength(1)
    expect(result[0]?.garageId).toBe('g1')
  })
})

// ── PropertyRuntimeService orchestration (mocked) ────────────────────────────

describe('PropertyRuntimeService orchestration', () => {
  function makePropertyRepo() {
    return {
      create: vi.fn(),
      transition: vi.fn(),
      setLock: vi.fn().mockResolvedValue(undefined),
      setAlarm: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByStatus: vi.fn().mockResolvedValue([]),
      listByOwner: vi.fn().mockResolvedValue([]),
      listByOrganization: vi.fn().mockResolvedValue([]),
    }
  }

  function makeRuntimeRepo() {
    return {
      upsertRuntime: vi.fn().mockResolvedValue({ propertyId: 'p1', occupantCount: 0 }),
      setBreach: vi.fn().mockResolvedValue(undefined),
      findByProperty: vi.fn().mockResolvedValue(null),
      enter: vi.fn(),
      exit: vi.fn(),
      listActiveOccupants: vi.fn().mockResolvedValue([]),
      evictAllOccupants: vi.fn().mockResolvedValue(undefined),
      cleanStaleOccupants: vi.fn().mockResolvedValue(0),
    }
  }

  it('findById returns null for unknown property', async () => {
    const { PropertyRuntimeService } = await import('@atc/property-runtime')
    const propertyRepo = makePropertyRepo()
    const svc = new PropertyRuntimeService({
      propertyRepo: propertyRepo as never,
      runtimeRepo: makeRuntimeRepo() as never,
      eventBus: undefined,
    })
    const result = await svc.findById('unknown')
    expect(result).toBeNull()
  })

  it('register delegates to propertyRepo.create', async () => {
    const { PropertyRuntimeService } = await import('@atc/property-runtime')
    const fakeProperty = { id: 'p1', name: 'Apt 4B', status: 'available' }
    const propertyRepo = makePropertyRepo()
    propertyRepo.create.mockResolvedValue(fakeProperty)
    const svc = new PropertyRuntimeService({
      propertyRepo: propertyRepo as never,
      runtimeRepo: makeRuntimeRepo() as never,
      eventBus: undefined,
    })
    const result = await svc.register({
      name: 'Apt 4B', address: '22 Vinewood', interiorType: 'apartment',
    })
    expect(result).toBe(fakeProperty)
    expect(propertyRepo.create).toHaveBeenCalledTimes(1)
  })

  it('purchase calls transition then upsertRuntime', async () => {
    const { PropertyRuntimeService } = await import('@atc/property-runtime')
    const fakeProperty = { id: 'p1', name: 'Apt 4B', status: 'owned' }
    const propertyRepo = makePropertyRepo()
    propertyRepo.transition.mockResolvedValue(fakeProperty)
    const runtimeRepo = makeRuntimeRepo()
    const eventBus = { emit: vi.fn().mockResolvedValue(undefined) }

    const svc = new PropertyRuntimeService({
      propertyRepo: propertyRepo as never,
      runtimeRepo: runtimeRepo as never,
      eventBus: eventBus as never,
    })
    const result = await svc.purchase('p1', { buyerPrincipalId: 'player_001' })
    expect(result).toBe(fakeProperty)
    expect(propertyRepo.transition).toHaveBeenCalledWith(expect.objectContaining({
      id: 'p1', newStatus: 'owned',
    }))
    expect(runtimeRepo.upsertRuntime).toHaveBeenCalledWith('p1')
    expect(eventBus.emit).toHaveBeenCalledWith('atc:property:purchased', expect.any(Object))
  })

  it('purchase emits PROPERTY_PURCHASED event', async () => {
    const { PropertyRuntimeService } = await import('@atc/property-runtime')
    const propertyRepo = makePropertyRepo()
    propertyRepo.transition.mockResolvedValue({ id: 'p1', status: 'owned' })
    const eventBus = { emit: vi.fn().mockResolvedValue(undefined) }

    const svc = new PropertyRuntimeService({
      propertyRepo: propertyRepo as never,
      runtimeRepo: makeRuntimeRepo() as never,
      eventBus: eventBus as never,
    })
    await svc.purchase('p1', { buyerPrincipalId: 'player_001' })
    expect(eventBus.emit).toHaveBeenCalledWith(
      'atc:property:purchased',
      expect.objectContaining({ propertyId: 'p1', ownerId: 'player_001' }),
    )
  })
})

// ── EmergencyAccessService ────────────────────────────────────────────────────

describe('EmergencyAccessService', () => {
  function makeDeps() {
    const propertyRepo = {
      findById: vi.fn(),
      transition: vi.fn(),
      setLock: vi.fn().mockResolvedValue(undefined),
      setAlarm: vi.fn(),
      create: vi.fn(),
      findByStatus: vi.fn(),
      listByOwner: vi.fn(),
      listByOrganization: vi.fn(),
    }
    const runtimeRepo = {
      upsertRuntime: vi.fn().mockResolvedValue({}),
      setBreach: vi.fn().mockResolvedValue(undefined),
      findByProperty: vi.fn().mockResolvedValue({ occupantCount: 0 }),
      enter: vi.fn(),
      exit: vi.fn(),
      listActiveOccupants: vi.fn(),
      evictAllOccupants: vi.fn(),
      cleanStaleOccupants: vi.fn(),
    }
    const accessRepo = {
      grant: vi.fn().mockResolvedValue({}),
      revoke: vi.fn(),
      findActiveForPrincipal: vi.fn(),
      listActiveForProperty: vi.fn(),
      issueKey: vi.fn(),
      revokeKey: vi.fn(),
      listActiveKeysForProperty: vi.fn(),
      findActiveKeyForPrincipal: vi.fn(),
    }
    return { propertyRepo, runtimeRepo, accessRepo }
  }

  it('breach transitions property to breached state', async () => {
    const { EmergencyAccessService } = await import('@atc/property-runtime')
    const { propertyRepo, runtimeRepo, accessRepo } = makeDeps()
    const fakeProperty = { id: 'p1', status: 'locked' }
    propertyRepo.findById.mockResolvedValue(fakeProperty)
    propertyRepo.transition.mockResolvedValue({ ...fakeProperty, status: 'breached' })
    const eventBus = { emit: vi.fn().mockResolvedValue(undefined) }

    const svc = new EmergencyAccessService({
      propertyRepo: propertyRepo as never,
      runtimeRepo: runtimeRepo as never,
      accessRepo: accessRepo as never,
      eventBus: eventBus as never,
    })

    const result = await svc.breach('p1', {
      breachingPrincipalId: 'officer_001',
      accessType: 'emergency_law',
      reason: 'Warrant execution',
    })
    expect(result.status).toBe('breached')
    expect(runtimeRepo.setBreach).toHaveBeenCalledWith('p1', 'officer_001', 'Warrant execution')
    expect(eventBus.emit).toHaveBeenCalledWith('atc:property:breached', expect.any(Object))
  })

  it('breach rejects when property is already seized', async () => {
    const { EmergencyAccessService } = await import('@atc/property-runtime')
    const { propertyRepo, runtimeRepo, accessRepo } = makeDeps()
    propertyRepo.findById.mockResolvedValue({ id: 'p1', status: 'seized' })

    const svc = new EmergencyAccessService({
      propertyRepo: propertyRepo as never,
      runtimeRepo: runtimeRepo as never,
      accessRepo: accessRepo as never,
      eventBus: undefined,
    })

    await expect(svc.breach('p1', {
      breachingPrincipalId: 'officer_001',
      accessType: 'emergency_law',
      reason: 'Warrant',
    })).rejects.toBeInstanceOf(EmergencyAccessError)
  })

  it('breach grants temporary emergency access', async () => {
    const { EmergencyAccessService } = await import('@atc/property-runtime')
    const { propertyRepo, runtimeRepo, accessRepo } = makeDeps()
    propertyRepo.findById.mockResolvedValue({ id: 'p1', status: 'owned' })
    propertyRepo.transition.mockResolvedValue({ id: 'p1', status: 'breached' })

    const svc = new EmergencyAccessService({
      propertyRepo: propertyRepo as never,
      runtimeRepo: runtimeRepo as never,
      accessRepo: accessRepo as never,
      eventBus: undefined,
    })

    await svc.breach('p1', {
      breachingPrincipalId: 'medic_001',
      accessType: 'emergency_ems',
      reason: 'Unresponsive patient',
    })

    expect(accessRepo.grant).toHaveBeenCalledWith(expect.objectContaining({
      propertyId: 'p1',
      principalId: 'medic_001',
      accessType: 'emergency_ems',
      expiresInSeconds: 300,
    }))
  })
})

// ── StorageContainerService ───────────────────────────────────────────────────

describe('StorageContainerService', () => {
  it('deposit delegates to stashRepo.deposit with stash id lookup', async () => {
    const { StorageContainerService } = await import('@atc/property-runtime')
    const fakeStash = { id: 'sr1', propertyId: 'p1', stashId: 'main_stash', capacity: 50 }
    const fakeItem = { id: 'i1', itemName: 'bandage', quantity: 3 }
    const stashRepo = {
      findByStashId: vi.fn().mockResolvedValue(fakeStash),
      deposit: vi.fn().mockResolvedValue(fakeItem),
      withdraw: vi.fn(),
      createStash: vi.fn(),
      findByRecordId: vi.fn(),
      listByProperty: vi.fn(),
      getContents: vi.fn(),
      findItem: vi.fn(),
    }
    const svc = new StorageContainerService({ stashRepo: stashRepo as never, eventBus: undefined })
    const result = await svc.deposit('p1', 'main_stash', {
      itemName: 'bandage', quantity: 3, addedByPrincipalId: 'medic_001',
    })
    expect(result).toBe(fakeItem)
    expect(stashRepo.deposit).toHaveBeenCalledWith('sr1', 'bandage', 3, null, 'medic_001')
  })

  it('deposit throws StashNotFoundError when stash missing', async () => {
    const { StorageContainerService, StashNotFoundError: SNF } = await import('@atc/property-runtime')
    const stashRepo = {
      findByStashId: vi.fn().mockResolvedValue(null),
      deposit: vi.fn(),
      withdraw: vi.fn(),
      createStash: vi.fn(),
      findByRecordId: vi.fn(),
      listByProperty: vi.fn(),
      getContents: vi.fn(),
      findItem: vi.fn(),
    }
    const svc = new StorageContainerService({ stashRepo: stashRepo as never, eventBus: undefined })

    await expect(svc.deposit('p1', 'nonexistent', {
      itemName: 'item', quantity: 1, addedByPrincipalId: 'player_001',
    })).rejects.toBeInstanceOf(SNF)
  })
})

// ── PropertyGarageService ─────────────────────────────────────────────────────

describe('PropertyGarageService', () => {
  it('retrieveVehicle throws when garage not linked to property', async () => {
    const { PropertyGarageService, PropertyGarageNotFoundError: PGNF } = await import('@atc/property-runtime')
    const garageRepo = {
      link: vi.fn(),
      unlink: vi.fn(),
      findActive: vi.fn().mockResolvedValue(null), // not linked
      listActiveForProperty: vi.fn(),
    }
    const svc = new PropertyGarageService({
      garageRepo: garageRepo as never,
      vehicleRuntimeService: undefined,
      eventBus: undefined,
    })

    await expect(svc.retrieveVehicle('p1', {
      vehicleId: 'v1',
      garageId: 'g_unknown',
      retrievedByPrincipalId: 'player_001',
      x: 0, y: 0, z: 0,
    })).rejects.toBeInstanceOf(PGNF)
  })

  it('linkGarage delegates to repo and emits event', async () => {
    const { PropertyGarageService } = await import('@atc/property-runtime')
    const fakeGarage = { id: 'pg1', propertyId: 'p1', garageId: 'g1' }
    const garageRepo = {
      link: vi.fn().mockResolvedValue(fakeGarage),
      unlink: vi.fn(),
      findActive: vi.fn(),
      listActiveForProperty: vi.fn(),
    }
    const eventBus = { emit: vi.fn().mockResolvedValue(undefined) }
    const svc = new PropertyGarageService({
      garageRepo: garageRepo as never,
      vehicleRuntimeService: undefined,
      eventBus: eventBus as never,
    })
    const result = await svc.linkGarage('p1', {
      garageId: 'g1', linkedByPrincipalId: 'owner_001',
    })
    expect(result).toBe(fakeGarage)
    expect(eventBus.emit).toHaveBeenCalledWith('atc:property:garage:linked', expect.any(Object))
  })
})

// ── InteriorStateService ──────────────────────────────────────────────────────

describe('InteriorStateService', () => {
  it('cleanStaleOccupants delegates to runtimeRepo', async () => {
    const { InteriorStateService } = await import('@atc/property-runtime')
    const runtimeRepo = {
      upsertRuntime: vi.fn(),
      setBreach: vi.fn(),
      findByProperty: vi.fn(),
      enter: vi.fn(),
      exit: vi.fn(),
      listActiveOccupants: vi.fn(),
      evictAllOccupants: vi.fn(),
      cleanStaleOccupants: vi.fn().mockResolvedValue(7),
    }
    const svc = new InteriorStateService({
      propertyRepo: {} as never,
      runtimeRepo: runtimeRepo as never,
      eventBus: undefined,
    })
    const cleaned = await svc.cleanStaleOccupants(30)
    expect(cleaned).toBe(7)
    expect(runtimeRepo.cleanStaleOccupants).toHaveBeenCalledWith(30)
  })
})

// ── PropertyAccessService ─────────────────────────────────────────────────────

describe('PropertyAccessService', () => {
  it('checkAccess returns false when no grants and no key', async () => {
    const { PropertyAccessService } = await import('@atc/property-runtime')
    const accessRepo = {
      grant: vi.fn(),
      revoke: vi.fn(),
      findActiveForPrincipal: vi.fn().mockResolvedValue([]),
      listActiveForProperty: vi.fn(),
      issueKey: vi.fn(),
      revokeKey: vi.fn(),
      listActiveKeysForProperty: vi.fn(),
      findActiveKeyForPrincipal: vi.fn().mockResolvedValue(null),
    }
    const svc = new PropertyAccessService({ accessRepo: accessRepo as never, eventBus: undefined })
    const result = await svc.checkAccess('p1', 'stranger_001')
    expect(result.hasAccess).toBe(false)
    expect(result.accessTypes).toHaveLength(0)
  })

  it('checkAccess returns true when active grant exists', async () => {
    const { PropertyAccessService } = await import('@atc/property-runtime')
    const fakeGrant = { id: 'a1', accessType: 'tenant' }
    const accessRepo = {
      grant: vi.fn(),
      revoke: vi.fn(),
      findActiveForPrincipal: vi.fn().mockResolvedValue([fakeGrant]),
      listActiveForProperty: vi.fn(),
      issueKey: vi.fn(),
      revokeKey: vi.fn(),
      listActiveKeysForProperty: vi.fn(),
      findActiveKeyForPrincipal: vi.fn().mockResolvedValue(null),
    }
    const svc = new PropertyAccessService({ accessRepo: accessRepo as never, eventBus: undefined })
    const result = await svc.checkAccess('p1', 'tenant_001')
    expect(result.hasAccess).toBe(true)
    expect(result.accessTypes).toContain('tenant')
  })
})
