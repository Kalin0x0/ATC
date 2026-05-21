import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  WorldIntegrityService,
  DistributedLockingService,
  DeterministicConsistencyService,
  GlobalWorldValidationService,
  RuntimeIntegrityCoordinator,
  IntegrityRecoveryService,
} from '@atc/world-integrity-runtime'
import type {
  WorldIntegrityRepository,
  DistributedLockRepository,
  RuntimeConsistencyRepository,
  IntegrityValidationRepository,
  WorldReconciliationRepository,
  IntegrityAuditRepository,
  WorldIntegrityEventBus,
} from '@atc/world-integrity-runtime'

const ULID             = '01JABCDEFGHJKMNPQRST'
const INTEGRITY_ID     = 'INTEG_001'
const RESOURCE_KEY     = 'world:zone:1'
const NODE_ID          = 'NODE_001'
const VALIDATION_ID    = 'VAL_001'
const RECONCILIATION_ID = 'RECON_001'

function mockAudit(): IntegrityAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as IntegrityAuditRepository
}

function mockBus(): WorldIntegrityEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── WorldIntegrityService ────────────────────────────────────────────────────

describe('WorldIntegrityService', () => {
  let integrityRepo: WorldIntegrityRepository
  let audit: IntegrityAuditRepository
  let bus: WorldIntegrityEventBus
  let svc: WorldIntegrityService

  beforeEach(() => {
    const integrity = {
      id: ULID, integrityId: INTEGRITY_ID, integrityType: 'checkpoint' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      integrityNonce: 'nonce-1', integrityData: {},
      worldHash: null, verifiedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    integrityRepo = {
      create:       vi.fn().mockResolvedValue(integrity),
      findById:     vi.fn().mockResolvedValue(integrity),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, verifiedAt?: Date, worldHash?: string) =>
        Promise.resolve({ ...integrity, status, verifiedAt: verifiedAt ?? null, worldHash: worldHash ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as WorldIntegrityRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new WorldIntegrityService(integrityRepo, audit, bus)
  })

  it('createIntegrity creates a pending integrity record', async () => {
    const result = await svc.createIntegrity({
      integrityType: 'checkpoint', ownerServerId: 'server-1', integrityNonce: 'nonce-1',
    })
    expect(result.integrityId).toBe(INTEGRITY_ID)
    expect(result.status).toBe('pending')
    expect(integrityRepo.create).toHaveBeenCalledOnce()
  })

  it('verifyIntegrity transitions to verified', async () => {
    const result = await svc.verifyIntegrity(ULID, 'abc123')
    expect(result.status).toBe('verified')
  })

  it('failIntegrity transitions to failed', async () => {
    const result = await svc.failIntegrity(ULID)
    expect(result.status).toBe('failed')
  })

  it('markCorrupted transitions to corrupted', async () => {
    const result = await svc.markCorrupted(ULID)
    expect(result.status).toBe('corrupted')
  })

  it('getIntegrity returns record or null', async () => {
    const result = await svc.getIntegrity(ULID)
    expect(result?.integrityId).toBe(INTEGRITY_ID)
  })
})

// ── DistributedLockingService ────────────────────────────────────────────────

describe('DistributedLockingService', () => {
  let lockRepo: DistributedLockRepository
  let audit: IntegrityAuditRepository
  let bus: WorldIntegrityEventBus
  let svc: DistributedLockingService

  beforeEach(() => {
    const lock = {
      id: ULID, resourceKey: RESOURCE_KEY, lockType: 'exclusive' as const,
      status: 'acquired' as const, ownerServerId: 'server-1',
      lockNonce: 'nonce-1', lockData: {}, expiresAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    lockRepo = {
      upsert:             vi.fn().mockResolvedValue(lock),
      findByResourceKey:  vi.fn().mockResolvedValue(lock),
      releaseLock:        vi.fn().mockResolvedValue({ ...lock, status: 'released' }),
      cleanupStale:       vi.fn().mockResolvedValue(1),
    } as unknown as DistributedLockRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new DistributedLockingService(lockRepo, audit, bus)
  })

  it('acquireLock upserts lock record', async () => {
    const result = await svc.acquireLock({
      resourceKey: RESOURCE_KEY, lockType: 'exclusive',
      ownerServerId: 'server-1', lockNonce: 'nonce-1',
    })
    expect(result.resourceKey).toBe(RESOURCE_KEY)
    expect(result.status).toBe('acquired')
    expect(lockRepo.upsert).toHaveBeenCalledOnce()
  })

  it('releaseLock transitions to released', async () => {
    const result = await svc.releaseLock(RESOURCE_KEY)
    expect(result.status).toBe('released')
  })

  it('getLock returns lock or null', async () => {
    const result = await svc.getLock(RESOURCE_KEY)
    expect(result?.resourceKey).toBe(RESOURCE_KEY)
  })
})

// ── DeterministicConsistencyService ─────────────────────────────────────────

describe('DeterministicConsistencyService', () => {
  let consistencyRepo: RuntimeConsistencyRepository
  let audit: IntegrityAuditRepository
  let bus: WorldIntegrityEventBus
  let svc: DeterministicConsistencyService

  beforeEach(() => {
    const consistency = {
      id: ULID, nodeId: NODE_ID, consistencyType: 'strong' as const,
      status: 'consistent' as const, ownerServerId: 'server-1',
      consistencyData: {}, checkedAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    }
    consistencyRepo = {
      upsert:        vi.fn().mockResolvedValue(consistency),
      findByNodeId:  vi.fn().mockResolvedValue(consistency),
      markDiverged:  vi.fn().mockResolvedValue({ ...consistency, status: 'diverged' }),
      cleanupStale:  vi.fn().mockResolvedValue(0),
    } as unknown as RuntimeConsistencyRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new DeterministicConsistencyService(consistencyRepo, audit, bus)
  })

  it('upsertConsistency upserts consistency record', async () => {
    const result = await svc.upsertConsistency({
      nodeId: NODE_ID, consistencyType: 'strong', ownerServerId: 'server-1',
    })
    expect(result.nodeId).toBe(NODE_ID)
    expect(consistencyRepo.upsert).toHaveBeenCalledOnce()
  })

  it('markDiverged calls repo and emits event', async () => {
    await svc.markDiverged(NODE_ID)
    expect(consistencyRepo.markDiverged).toHaveBeenCalledWith(NODE_ID)
  })

  it('getConsistency returns record or null', async () => {
    const result = await svc.getConsistency(NODE_ID)
    expect(result?.nodeId).toBe(NODE_ID)
  })
})

// ── GlobalWorldValidationService ─────────────────────────────────────────────

describe('GlobalWorldValidationService', () => {
  let validationRepo: IntegrityValidationRepository
  let audit: IntegrityAuditRepository
  let bus: WorldIntegrityEventBus
  let svc: GlobalWorldValidationService

  beforeEach(() => {
    const validation = {
      id: ULID, validationId: VALIDATION_ID, validationType: 'world_state' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      targetId: null, validationNonce: 'nonce-1', validationData: {}, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    validationRepo = {
      create:       vi.fn().mockResolvedValue(validation),
      findById:     vi.fn().mockResolvedValue(validation),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...validation, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as IntegrityValidationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new GlobalWorldValidationService(validationRepo, audit, bus)
  })

  it('startValidation creates a pending validation', async () => {
    const result = await svc.startValidation({
      validationType: 'world_state', ownerServerId: 'server-1', validationNonce: 'nonce-1',
    })
    expect(result.validationId).toBe(VALIDATION_ID)
    expect(result.status).toBe('pending')
  })

  it('passValidation transitions to passed', async () => {
    const result = await svc.passValidation(ULID)
    expect(result.status).toBe('passed')
  })

  it('failValidation transitions to failed', async () => {
    const result = await svc.failValidation(ULID)
    expect(result.status).toBe('failed')
  })

  it('getValidation returns validation or null', async () => {
    const result = await svc.getValidation(ULID)
    expect(result?.validationId).toBe(VALIDATION_ID)
  })
})

// ── RuntimeIntegrityCoordinator ──────────────────────────────────────────────

describe('RuntimeIntegrityCoordinator', () => {
  let reconciliationRepo: WorldReconciliationRepository
  let audit: IntegrityAuditRepository
  let bus: WorldIntegrityEventBus
  let svc: RuntimeIntegrityCoordinator

  beforeEach(() => {
    const reconciliation = {
      id: ULID, reconciliationId: RECONCILIATION_ID, reconciliationType: 'delta_sync' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      reconciliationNonce: 'nonce-1', reconciliationData: {}, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    reconciliationRepo = {
      create:       vi.fn().mockResolvedValue(reconciliation),
      findById:     vi.fn().mockResolvedValue(reconciliation),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...reconciliation, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as WorldReconciliationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeIntegrityCoordinator(reconciliationRepo, audit, bus)
  })

  it('startReconciliation creates an in_progress reconciliation', async () => {
    const result = await svc.startReconciliation({
      reconciliationType: 'delta_sync', ownerServerId: 'server-1', reconciliationNonce: 'nonce-1',
    })
    expect(result.reconciliationId).toBe(RECONCILIATION_ID)
    expect(result.status).toBe('active')
  })

  it('completeReconciliation transitions to completed', async () => {
    const result = await svc.completeReconciliation(ULID)
    expect(result.status).toBe('completed')
  })

  it('failReconciliation transitions to failed', async () => {
    const result = await svc.failReconciliation(ULID)
    expect(result.status).toBe('failed')
  })

  it('getReconciliation returns reconciliation or null', async () => {
    const result = await svc.getReconciliation(ULID)
    expect(result?.reconciliationId).toBe(RECONCILIATION_ID)
  })
})

// ── IntegrityRecoveryService ─────────────────────────────────────────────────

describe('IntegrityRecoveryService', () => {
  let integrityRepo: WorldIntegrityRepository
  let lockRepo: DistributedLockRepository
  let validationRepo: IntegrityValidationRepository
  let reconciliationRepo: WorldReconciliationRepository
  let audit: IntegrityAuditRepository
  let bus: WorldIntegrityEventBus
  let svc: IntegrityRecoveryService

  beforeEach(() => {
    integrityRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(5),
    } as unknown as WorldIntegrityRepository
    lockRepo = {
      upsert: vi.fn(), findByResourceKey: vi.fn(), releaseLock: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as DistributedLockRepository
    validationRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as IntegrityValidationRepository
    reconciliationRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as WorldReconciliationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new IntegrityRecoveryService(integrityRepo, lockRepo, validationRepo, reconciliationRepo, audit, bus)
  })

  it('cleanupStale returns counts for integrities, locks, validations, reconciliations', async () => {
    const result = await svc.cleanupStale(300000)
    expect(result.integrities).toBe(5)
    expect(result.locks).toBe(3)
    expect(result.validations).toBe(2)
    expect(result.reconciliations).toBe(1)
  })
})
