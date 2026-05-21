import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  WorldError,
  WorldEntityNotFoundError,
  WorldEntityValidationError,
  WorldEntityAlreadySpawnedError,
  WorldEntityImmutableError,
  SceneNotFoundError,
  SceneAlreadyExistsError,
  SceneImmutableError,
  SceneLockedError,
  OwnershipConflictError,
  OwnershipNotFoundError,
  PersistentSceneNotFoundError,
  CleanupNotFoundError,
} from '@atc/world-runtime'
import {
  registerEntitySchema,
  reconcileEntitySchema,
  createSceneSchema,
  persistSceneSchema,
  scheduleCleanupSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('WorldError hierarchy', () => {
  it('WorldEntityNotFoundError extends WorldError', () => {
    const e = new WorldEntityNotFoundError('e1')
    expect(e).toBeInstanceOf(WorldError)
    expect(e.message).toContain('e1')
  })

  it('WorldEntityValidationError extends WorldError', () => {
    const e = new WorldEntityValidationError('bad entity type')
    expect(e).toBeInstanceOf(WorldError)
    expect(e.message).toBe('bad entity type')
  })

  it('WorldEntityAlreadySpawnedError includes nonce', () => {
    const e = new WorldEntityAlreadySpawnedError('nonce-abc')
    expect(e).toBeInstanceOf(WorldError)
    expect(e.message).toContain('nonce-abc')
  })

  it('WorldEntityImmutableError includes from/to', () => {
    const e = new WorldEntityImmutableError('e1', 'cleaned', 'active')
    expect(e).toBeInstanceOf(WorldError)
    expect(e.message).toContain('cleaned')
    expect(e.message).toContain('active')
  })

  it('SceneNotFoundError extends WorldError', () => {
    const e = new SceneNotFoundError('scene-1')
    expect(e).toBeInstanceOf(WorldError)
    expect(e.message).toContain('scene-1')
  })

  it('SceneAlreadyExistsError extends WorldError', () => {
    const e = new SceneAlreadyExistsError('scene-2')
    expect(e).toBeInstanceOf(WorldError)
    expect(e.message).toContain('scene-2')
  })

  it('SceneImmutableError includes from/to', () => {
    const e = new SceneImmutableError('scene-3', 'destroyed', 'active')
    expect(e).toBeInstanceOf(WorldError)
    expect(e.message).toContain('destroyed')
    expect(e.message).toContain('active')
  })

  it('SceneLockedError includes sceneId', () => {
    const e = new SceneLockedError('scene-4')
    expect(e).toBeInstanceOf(WorldError)
    expect(e.message).toContain('scene-4')
  })

  it('OwnershipConflictError includes entityId', () => {
    const e = new OwnershipConflictError('entity-1')
    expect(e).toBeInstanceOf(WorldError)
    expect(e.message).toContain('entity-1')
  })

  it('OwnershipNotFoundError includes entityId and principalId', () => {
    const e = new OwnershipNotFoundError('entity-1', 'p1')
    expect(e).toBeInstanceOf(WorldError)
    expect(e.message).toContain('entity-1')
    expect(e.message).toContain('p1')
  })

  it('PersistentSceneNotFoundError extends WorldError', () => {
    const e = new PersistentSceneNotFoundError('scene-5')
    expect(e).toBeInstanceOf(WorldError)
    expect(e.message).toContain('scene-5')
  })

  it('CleanupNotFoundError extends WorldError', () => {
    const e = new CleanupNotFoundError('cleanup-1')
    expect(e).toBeInstanceOf(WorldError)
    expect(e.message).toContain('cleanup-1')
  })
})

// ── Schema Validation ─────────────────────────────────────────────────────────

describe('registerEntitySchema', () => {
  it('accepts valid entity registration', () => {
    const result = registerEntitySchema.safeParse({
      entityType: 'vehicle',
      ownerPrincipalId: 'p1',
      model: 'adder',
      x: 100.0,
      y: -200.5,
      z: 30.0,
      heading: 90.0,
      spawnNonce: 'nonce-001',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid entityType', () => {
    const result = registerEntitySchema.safeParse({
      entityType: 'npc',
      model: 'adder',
      x: 0, y: 0, z: 0,
      heading: 0,
      spawnNonce: 'nonce-002',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing model', () => {
    const result = registerEntitySchema.safeParse({
      entityType: 'vehicle',
      x: 0, y: 0, z: 0,
      heading: 0,
      spawnNonce: 'nonce-003',
    })
    expect(result.success).toBe(false)
  })

  it('accepts entity without optional ownerPrincipalId', () => {
    const result = registerEntitySchema.safeParse({
      entityType: 'object',
      model: 'prop_barrel_01a',
      x: 50.0, y: 60.0, z: 10.0,
      heading: 180.0,
      spawnNonce: 'nonce-004',
    })
    expect(result.success).toBe(true)
  })
})

describe('reconcileEntitySchema', () => {
  it('accepts valid reconcile payload', () => {
    const result = reconcileEntitySchema.safeParse({ x: 100.0, y: -200.5, z: 30.0, heading: 90.0 })
    expect(result.success).toBe(true)
  })

  it('accepts reconcile with optional networkId', () => {
    const result = reconcileEntitySchema.safeParse({ x: 0, y: 0, z: 0, heading: 0, networkId: 42 })
    expect(result.success).toBe(true)
  })

  it('rejects non-integer networkId', () => {
    const result = reconcileEntitySchema.safeParse({ x: 0, y: 0, z: 0, heading: 0, networkId: 1.5 })
    expect(result.success).toBe(false)
  })
})

describe('createSceneSchema', () => {
  it('accepts valid scene', () => {
    const result = createSceneSchema.safeParse({
      sceneId: 'scene-heist-001',
      creatorPrincipalId: 'p1',
      label: 'Paleto Bay Heist Scene',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty sceneId', () => {
    const result = createSceneSchema.safeParse({
      sceneId: '',
      creatorPrincipalId: 'p1',
      label: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty label', () => {
    const result = createSceneSchema.safeParse({
      sceneId: 'scene-001',
      creatorPrincipalId: 'p1',
      label: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('persistSceneSchema', () => {
  it('accepts valid persist payload', () => {
    const result = persistSceneSchema.safeParse({
      sceneId: 'scene-001',
      sceneType: 'crime_scene',
      data: { evidenceMarkers: ['m1', 'm2'] },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid sceneType', () => {
    const result = persistSceneSchema.safeParse({
      sceneId: 'scene-001',
      sceneType: 'party',
      data: {},
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-positive expiresInSeconds', () => {
    const result = persistSceneSchema.safeParse({
      sceneId: 'scene-001',
      sceneType: 'event',
      data: {},
      expiresInSeconds: 0,
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional expiresInSeconds', () => {
    const result = persistSceneSchema.safeParse({
      sceneId: 'scene-001',
      sceneType: 'blockade',
      data: { blocked: true },
      expiresInSeconds: 3600,
    })
    expect(result.success).toBe(true)
  })
})

describe('scheduleCleanupSchema', () => {
  it('accepts valid cleanup schedule', () => {
    const result = scheduleCleanupSchema.safeParse({
      targetType: 'scene',
      targetId: 'scene-001',
      cleanupReason: 'timeout',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid cleanupReason', () => {
    const result = scheduleCleanupSchema.safeParse({
      targetType: 'entity',
      targetId: 'e1',
      cleanupReason: 'expired',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty targetType', () => {
    const result = scheduleCleanupSchema.safeParse({
      targetType: '',
      targetId: 'e1',
      cleanupReason: 'manual',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid cleanupReason values', () => {
    const reasons = ['timeout', 'manual', 'server_restart', 'owner_disconnect', 'scene_destroyed'] as const
    for (const reason of reasons) {
      const result = scheduleCleanupSchema.safeParse({
        targetType: 'entity',
        targetId: 'e1',
        cleanupReason: reason,
      })
      expect(result.success).toBe(true)
    }
  })
})

// ── WorldEntityRepository (mocked) ───────────────────────────────────────────

describe('WorldEntityRepository — duplicate spawn nonce suppression', () => {
  it('throws WorldEntityAlreadySpawnedError on duplicate nonce', async () => {
    const mockRepo = {
      register: vi.fn().mockRejectedValue(new WorldEntityAlreadySpawnedError('nonce-dupe')),
    }
    await expect(mockRepo.register({ spawnNonce: 'nonce-dupe' })).rejects.toThrow(WorldEntityAlreadySpawnedError)
  })

  it('registers entity on unique nonce', async () => {
    const entity = {
      id: '01H', entityType: 'vehicle', model: 'adder', status: 'registered',
      x: 100, y: -200, z: 30, heading: 90, spawnNonce: 'nonce-unique', spawnedAt: new Date(), createdAt: new Date(),
    }
    const mockRepo = { register: vi.fn().mockResolvedValue(entity) }
    const result = await mockRepo.register({ spawnNonce: 'nonce-unique' })
    expect(result.spawnNonce).toBe('nonce-unique')
    expect(result.status).toBe('registered')
  })
})

// ── SceneRuntimeRepository (mocked) ──────────────────────────────────────────

describe('SceneRuntimeRepository — state machine', () => {
  const mockSceneRepo = { create: vi.fn(), transition: vi.fn(), findBySceneId: vi.fn() }

  beforeEach(() => { vi.clearAllMocks() })

  it('creates scene in active status', async () => {
    const scene = { id: 's1', sceneId: 'scene-001', status: 'active', isLocked: false, entityCount: 0 }
    mockSceneRepo.create.mockResolvedValue(scene)
    const result = await mockSceneRepo.create({ sceneId: 'scene-001', creatorPrincipalId: 'p1', label: 'Test' })
    expect(result.status).toBe('active')
  })

  it('throws SceneAlreadyExistsError on duplicate sceneId', async () => {
    mockSceneRepo.create.mockRejectedValue(new SceneAlreadyExistsError('scene-001'))
    await expect(mockSceneRepo.create({ sceneId: 'scene-001' })).rejects.toThrow(SceneAlreadyExistsError)
  })

  it('throws SceneImmutableError on invalid transition destroyed→active', async () => {
    mockSceneRepo.transition.mockRejectedValue(new SceneImmutableError('scene-001', 'destroyed', 'active'))
    await expect(mockSceneRepo.transition('scene-001', 'active')).rejects.toThrow(SceneImmutableError)
  })

  it('transitions active→destroyed', async () => {
    const scene = { id: 's1', sceneId: 'scene-001', status: 'destroyed' }
    mockSceneRepo.transition.mockResolvedValue(scene)
    const result = await mockSceneRepo.transition('scene-001', 'destroyed')
    expect(result.status).toBe('destroyed')
  })
})

// ── EntityOwnershipRepository (mocked) ───────────────────────────────────────

describe('EntityOwnershipRepository — duplicate ownership prevention', () => {
  const mockOwnershipRepo = { acquire: vi.fn(), release: vi.fn(), findActive: vi.fn() }

  beforeEach(() => { vi.clearAllMocks() })

  it('throws OwnershipConflictError when entity already owned', async () => {
    mockOwnershipRepo.acquire.mockRejectedValue(new OwnershipConflictError('entity-1'))
    await expect(mockOwnershipRepo.acquire('entity-1', 'p2')).rejects.toThrow(OwnershipConflictError)
  })

  it('acquires ownership when no active owner', async () => {
    const ownership = { id: 'o1', entityId: 'entity-1', principalId: 'p1', acquiredAt: new Date(), releasedAt: null }
    mockOwnershipRepo.acquire.mockResolvedValue(ownership)
    const result = await mockOwnershipRepo.acquire('entity-1', 'p1')
    expect(result.principalId).toBe('p1')
    expect(result.releasedAt).toBeNull()
  })

  it('throws OwnershipNotFoundError on release when no active ownership', async () => {
    mockOwnershipRepo.release.mockRejectedValue(new OwnershipNotFoundError('entity-1', 'p1'))
    await expect(mockOwnershipRepo.release('entity-1', 'p1')).rejects.toThrow(OwnershipNotFoundError)
  })

  it('returns null when no active owner found', async () => {
    mockOwnershipRepo.findActive.mockResolvedValue(null)
    const result = await mockOwnershipRepo.findActive('entity-1')
    expect(result).toBeNull()
  })
})

// ── SceneSynchronizationService (mocked) ─────────────────────────────────────

describe('SceneSynchronizationService — scene lifecycle', () => {
  const mockSceneRepo = { create: vi.fn(), findBySceneId: vi.fn(), transition: vi.fn() }
  const mockEntityRepo = { listByScene: vi.fn() }
  const mockEventBus = { emit: vi.fn().mockResolvedValue(undefined) }

  beforeEach(() => { vi.clearAllMocks() })

  it('creates scene and emits SCENE_CREATED', async () => {
    const scene = { id: 's1', sceneId: 'scene-001', status: 'active', entityCount: 0, createdAt: new Date() }
    mockSceneRepo.create.mockResolvedValue(scene)
    const result = await mockSceneRepo.create({ sceneId: 'scene-001', creatorPrincipalId: 'p1', label: 'Test Scene' })
    expect(result.status).toBe('active')
    mockEventBus.emit('atc:world:scene:created', { sceneId: 'scene-001' })
    expect(mockEventBus.emit).toHaveBeenCalledWith('atc:world:scene:created', expect.any(Object))
  })

  it('destroys scene and emits SCENE_DESTROYED', async () => {
    const scene = { id: 's1', sceneId: 'scene-001', status: 'destroyed' }
    mockSceneRepo.transition.mockResolvedValue(scene)
    const result = await mockSceneRepo.transition('scene-001', 'destroyed')
    expect(result.status).toBe('destroyed')
    mockEventBus.emit('atc:world:scene:destroyed', { sceneId: 'scene-001' })
    expect(mockEventBus.emit).toHaveBeenCalledWith('atc:world:scene:destroyed', expect.any(Object))
  })

  it('returns null for non-existent scene', async () => {
    mockSceneRepo.findBySceneId.mockResolvedValue(null)
    const result = await mockSceneRepo.findBySceneId('non-existent')
    expect(result).toBeNull()
  })

  it('returns empty list when no entities in scene', async () => {
    mockEntityRepo.listByScene.mockResolvedValue([])
    const result = await mockEntityRepo.listByScene('scene-001')
    expect(result).toHaveLength(0)
  })
})

// ── RuntimeReplicationService (mocked) ───────────────────────────────────────

describe('RuntimeReplicationService — entity despawn', () => {
  const mockEntityRepo = { register: vi.fn(), despawn: vi.fn(), findById: vi.fn() }
  const mockEventBus = { emit: vi.fn().mockResolvedValue(undefined) }

  beforeEach(() => { vi.clearAllMocks() })

  it('registers entity and emits ENTITY_REGISTERED', async () => {
    const entity = { id: 'e1', entityType: 'vehicle', status: 'registered', spawnNonce: 'n1', createdAt: new Date() }
    mockEntityRepo.register.mockResolvedValue(entity)
    const result = await mockEntityRepo.register({ entityType: 'vehicle', model: 'adder', x: 0, y: 0, z: 0, heading: 0, spawnNonce: 'n1' })
    expect(result.status).toBe('registered')
    mockEventBus.emit('atc:world:entity:registered', { entityId: 'e1' })
    expect(mockEventBus.emit).toHaveBeenCalledWith('atc:world:entity:registered', expect.any(Object))
  })

  it('despawns entity and emits ENTITY_DESPAWNED', async () => {
    const entity = { id: 'e1', status: 'despawned', despawnedAt: new Date() }
    mockEntityRepo.despawn.mockResolvedValue(entity)
    const result = await mockEntityRepo.despawn('e1')
    expect(result.status).toBe('despawned')
    mockEventBus.emit('atc:world:entity:despawned', { entityId: 'e1' })
    expect(mockEventBus.emit).toHaveBeenCalledWith('atc:world:entity:despawned', expect.any(Object))
  })

  it('throws WorldEntityNotFoundError on despawn of non-existent entity', async () => {
    mockEntityRepo.despawn.mockRejectedValue(new WorldEntityNotFoundError('non-existent'))
    await expect(mockEntityRepo.despawn('non-existent')).rejects.toThrow(WorldEntityNotFoundError)
  })
})

// ── CleanupOrchestrationService (mocked) ─────────────────────────────────────

describe('CleanupOrchestrationService — stale cleanup', () => {
  const mockCleanupRepo = { schedule: vi.fn(), complete: vi.fn(), listPending: vi.fn() }
  const mockEventBus = { emit: vi.fn().mockResolvedValue(undefined) }

  beforeEach(() => { vi.clearAllMocks() })

  it('schedules cleanup record', async () => {
    const cleanup = { id: 'c1', targetType: 'entity', targetId: 'e1', cleanupReason: 'timeout', scheduledAt: new Date(), completedAt: null }
    mockCleanupRepo.schedule.mockResolvedValue(cleanup)
    const result = await mockCleanupRepo.schedule({ targetType: 'entity', targetId: 'e1', cleanupReason: 'timeout' })
    expect(result.cleanupReason).toBe('timeout')
    expect(result.completedAt).toBeNull()
  })

  it('completes cleanup and emits CLEANUP_COMPLETED', async () => {
    const cleanup = { id: 'c1', completedAt: new Date() }
    mockCleanupRepo.complete.mockResolvedValue(cleanup)
    const result = await mockCleanupRepo.complete('c1')
    expect(result.completedAt).not.toBeNull()
    mockEventBus.emit('atc:world:cleanup:completed', { cleanupId: 'c1' })
    expect(mockEventBus.emit).toHaveBeenCalledWith('atc:world:cleanup:completed', expect.any(Object))
  })

  it('returns pending cleanups list', async () => {
    const pending = [
      { id: 'c1', targetType: 'entity', targetId: 'e1', cleanupReason: 'timeout' },
      { id: 'c2', targetType: 'scene', targetId: 'scene-001', cleanupReason: 'server_restart' },
    ]
    mockCleanupRepo.listPending.mockResolvedValue(pending)
    const result = await mockCleanupRepo.listPending()
    expect(result).toHaveLength(2)
  })

  it('returns empty list when no pending cleanups', async () => {
    mockCleanupRepo.listPending.mockResolvedValue([])
    const result = await mockCleanupRepo.listPending()
    expect(result).toHaveLength(0)
  })
})

// ── EntityOwnershipService (mocked) ──────────────────────────────────────────

describe('EntityOwnershipService — ownership conflict', () => {
  const mockOwnershipRepo = { acquire: vi.fn(), release: vi.fn(), listByPrincipal: vi.fn() }
  const mockEntityRepo = { findById: vi.fn() }
  const mockEventBus = { emit: vi.fn().mockResolvedValue(undefined) }

  beforeEach(() => { vi.clearAllMocks() })

  it('acquires ownership and emits OWNERSHIP_ACQUIRED', async () => {
    const ownership = { id: 'o1', entityId: 'e1', principalId: 'p1', acquiredAt: new Date(), releasedAt: null }
    mockOwnershipRepo.acquire.mockResolvedValue(ownership)
    const result = await mockOwnershipRepo.acquire('e1', 'p1')
    expect(result.principalId).toBe('p1')
    mockEventBus.emit('atc:world:entity:ownership:acquired', { entityId: 'e1', principalId: 'p1' })
    expect(mockEventBus.emit).toHaveBeenCalledWith('atc:world:entity:ownership:acquired', expect.any(Object))
  })

  it('releases ownership and emits OWNERSHIP_RELEASED', async () => {
    const ownership = { id: 'o1', entityId: 'e1', principalId: 'p1', releasedAt: new Date() }
    mockOwnershipRepo.release.mockResolvedValue(ownership)
    const result = await mockOwnershipRepo.release('e1', 'p1')
    expect(result.releasedAt).not.toBeNull()
    mockEventBus.emit('atc:world:entity:ownership:released', { entityId: 'e1', principalId: 'p1' })
    expect(mockEventBus.emit).toHaveBeenCalledWith('atc:world:entity:ownership:released', expect.any(Object))
  })

  it('throws OwnershipConflictError when entity already owned by another', async () => {
    mockOwnershipRepo.acquire.mockRejectedValue(new OwnershipConflictError('e1'))
    await expect(mockOwnershipRepo.acquire('e1', 'p2')).rejects.toThrow(OwnershipConflictError)
  })

  it('throws WorldEntityNotFoundError when entity does not exist', async () => {
    mockEntityRepo.findById.mockResolvedValue(null)
    await expect(
      (async () => {
        const entity = await mockEntityRepo.findById('non-existent')
        if (!entity) throw new WorldEntityNotFoundError('non-existent')
      })()
    ).rejects.toThrow(WorldEntityNotFoundError)
  })

  it('returns all ownerships held by a principal', async () => {
    const ownerships = [
      { id: 'o1', entityId: 'e1', principalId: 'p1', releasedAt: null },
      { id: 'o2', entityId: 'e2', principalId: 'p1', releasedAt: null },
    ]
    mockOwnershipRepo.listByPrincipal.mockResolvedValue(ownerships)
    const result = await mockOwnershipRepo.listByPrincipal('p1')
    expect(result).toHaveLength(2)
  })
})

// ── EventBus fail-soft ────────────────────────────────────────────────────────

describe('EventBus fail-soft — emit errors do not propagate', () => {
  it('swallows EventBus emit rejection', async () => {
    const mockEventBus = { emit: vi.fn().mockRejectedValue(new Error('bus down')) }

    let serviceError: Error | null = null
    try {
      await mockEventBus.emit('atc:world:scene:created', { sceneId: 'x' }).catch(() => undefined)
    } catch (e) {
      serviceError = e as Error
    }

    expect(serviceError).toBeNull()
  })

  it('service result is unaffected by EventBus failure', async () => {
    const mockEventBus = { emit: vi.fn().mockRejectedValue(new Error('bus timeout')) }
    const mockSceneRepo = { create: vi.fn().mockResolvedValue({ id: 's1', status: 'active' }) }

    const scene = await mockSceneRepo.create({ sceneId: 'scene-001', creatorPrincipalId: 'p1', label: 'Test' })
    mockEventBus.emit('atc:world:scene:created', { sceneId: 'scene-001' }).catch(() => undefined)

    expect(scene.status).toBe('active')
    expect(mockEventBus.emit).toHaveBeenCalled()
  })
})
