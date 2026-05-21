import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RuntimeLockdownService,
  DeterministicClosureService,
  ProductionIntegrityService,
  RuntimeSealService,
  DistributedFinalizationService,
  LockdownRecoveryService,
} from '@atc/runtime-lockdown'
import type {
  RuntimeLockdownRepository,
  DeterministicClosureRepository,
  ProductionIntegrityRepository,
  RuntimeSealRepository,
  FinalizationRuntimeRepository,
  LockdownAuditRepository,
  RuntimeLockdownEventBus,
} from '@atc/runtime-lockdown'

const ULID          = '01JABCDEFGHJKMNPQRST'
const LOCKDOWN_ID   = 'LOCK_001'
const CLOSURE_ID    = 'CLOS_001'
const INTEGRITY_ID  = 'INTEG_001'
const SEAL_ID       = 'SEAL_001'
const RESOURCE_ID   = 'RES_001'
const FINAL_ID      = 'FINAL_001'

function mockAudit(): LockdownAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as LockdownAuditRepository
}

function mockBus(): RuntimeLockdownEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── RuntimeLockdownService ────────────────────────────────────────────────────

describe('RuntimeLockdownService', () => {
  let lockdownRepo: RuntimeLockdownRepository
  let audit: LockdownAuditRepository
  let bus: RuntimeLockdownEventBus
  let svc: RuntimeLockdownService

  beforeEach(() => {
    const lockdown = {
      id: ULID, lockdownId: LOCKDOWN_ID, lockdownType: 'full' as const,
      status: 'initiated' as const, ownerServerId: 'server-1',
      lockdownNonce: 'nonce-1', lockdownData: {}, liftedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    lockdownRepo = {
      create:       vi.fn().mockResolvedValue(lockdown),
      findById:     vi.fn().mockResolvedValue(lockdown),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, liftedAt?: Date) =>
        Promise.resolve({ ...lockdown, status, liftedAt: liftedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as RuntimeLockdownRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeLockdownService(lockdownRepo, audit, bus)
  })

  it('initiateLockdown creates an initiated lockdown', async () => {
    const result = await svc.initiateLockdown({
      lockdownType: 'full', ownerServerId: 'server-1', lockdownNonce: 'nonce-1',
    })
    expect(result.lockdownId).toBe(LOCKDOWN_ID)
    expect(result.status).toBe('initiated')
    expect(lockdownRepo.create).toHaveBeenCalledOnce()
  })

  it('activateLockdown transitions to active', async () => {
    const result = await svc.activateLockdown(ULID)
    expect(result.status).toBe('active')
  })

  it('beginLifting transitions to lifting', async () => {
    const result = await svc.beginLifting(ULID)
    expect(result.status).toBe('lifting')
  })

  it('liftLockdown transitions to lifted', async () => {
    const result = await svc.liftLockdown(ULID)
    expect(result.status).toBe('lifted')
  })

  it('failLockdown transitions to failed', async () => {
    const result = await svc.failLockdown(ULID)
    expect(result.status).toBe('failed')
  })

  it('getLockdown returns record or null', async () => {
    const result = await svc.getLockdown(ULID)
    expect(result?.lockdownId).toBe(LOCKDOWN_ID)
  })
})

// ── DeterministicClosureService ───────────────────────────────────────────────

describe('DeterministicClosureService', () => {
  let closureRepo: DeterministicClosureRepository
  let audit: LockdownAuditRepository
  let bus: RuntimeLockdownEventBus
  let svc: DeterministicClosureService

  beforeEach(() => {
    const closure = {
      id: ULID, closureId: CLOSURE_ID, closureType: 'graceful' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      closureNonce: 'nonce-1', closureData: {}, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    closureRepo = {
      create:       vi.fn().mockResolvedValue(closure),
      findById:     vi.fn().mockResolvedValue(closure),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...closure, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as DeterministicClosureRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new DeterministicClosureService(closureRepo, audit, bus)
  })

  it('startClosure creates a pending closure', async () => {
    const result = await svc.startClosure({
      closureType: 'graceful', ownerServerId: 'server-1', closureNonce: 'nonce-1',
    })
    expect(result.closureId).toBe(CLOSURE_ID)
    expect(result.status).toBe('pending')
  })

  it('progressClosure transitions to in_progress', async () => {
    const result = await svc.progressClosure(ULID)
    expect(result.status).toBe('in_progress')
  })

  it('completeClosure transitions to completed', async () => {
    const result = await svc.completeClosure(ULID)
    expect(result.status).toBe('completed')
  })

  it('abortClosure transitions to aborted', async () => {
    const result = await svc.abortClosure(ULID)
    expect(result.status).toBe('aborted')
  })

  it('getClosure returns record or null', async () => {
    const result = await svc.getClosure(ULID)
    expect(result?.closureId).toBe(CLOSURE_ID)
  })
})

// ── ProductionIntegrityService ────────────────────────────────────────────────

describe('ProductionIntegrityService', () => {
  let integrityRepo: ProductionIntegrityRepository
  let audit: LockdownAuditRepository
  let bus: RuntimeLockdownEventBus
  let svc: ProductionIntegrityService

  beforeEach(() => {
    const integrity = {
      id: ULID, integrityId: INTEGRITY_ID, integrityType: 'runtime' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      integrityNonce: 'nonce-1', integrityData: {}, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    integrityRepo = {
      create:       vi.fn().mockResolvedValue(integrity),
      findById:     vi.fn().mockResolvedValue(integrity),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...integrity, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as ProductionIntegrityRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new ProductionIntegrityService(integrityRepo, audit, bus)
  })

  it('createIntegrityCheck creates a pending integrity check', async () => {
    const result = await svc.createIntegrityCheck({
      integrityType: 'runtime', ownerServerId: 'server-1', integrityNonce: 'nonce-1',
    })
    expect(result.integrityId).toBe(INTEGRITY_ID)
    expect(result.status).toBe('pending')
  })

  it('beginRunning transitions to running', async () => {
    const result = await svc.beginRunning(ULID)
    expect(result.status).toBe('running')
  })

  it('passIntegrityCheck transitions to passed', async () => {
    const result = await svc.passIntegrityCheck(ULID)
    expect(result.status).toBe('passed')
  })

  it('failIntegrityCheck transitions to failed', async () => {
    const result = await svc.failIntegrityCheck(ULID)
    expect(result.status).toBe('failed')
  })

  it('getIntegrityCheck returns record or null', async () => {
    const result = await svc.getIntegrityCheck(ULID)
    expect(result?.integrityId).toBe(INTEGRITY_ID)
  })
})

// ── RuntimeSealService ────────────────────────────────────────────────────────

describe('RuntimeSealService', () => {
  let sealRepo: RuntimeSealRepository
  let audit: LockdownAuditRepository
  let bus: RuntimeLockdownEventBus
  let svc: RuntimeSealService

  beforeEach(() => {
    const seal = {
      id: ULID, sealId: SEAL_ID, sealType: 'checksum' as const,
      status: 'applied' as const, ownerServerId: 'server-1',
      resourceId: RESOURCE_ID, sealNonce: 'nonce-1', sealData: {}, verifiedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    sealRepo = {
      create:       vi.fn().mockResolvedValue(seal),
      findById:     vi.fn().mockResolvedValue(seal),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, verifiedAt?: Date) =>
        Promise.resolve({ ...seal, status, verifiedAt: verifiedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as RuntimeSealRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeSealService(sealRepo, audit, bus)
  })

  it('applySeal creates an applied seal', async () => {
    const result = await svc.applySeal({
      sealType: 'checksum', ownerServerId: 'server-1',
      resourceId: RESOURCE_ID, sealNonce: 'nonce-1',
    })
    expect(result.sealId).toBe(SEAL_ID)
    expect(result.status).toBe('applied')
    expect(sealRepo.create).toHaveBeenCalledOnce()
  })

  it('verifySeal transitions to verified', async () => {
    const result = await svc.verifySeal(ULID)
    expect(result.status).toBe('verified')
  })

  it('breakSeal transitions to broken', async () => {
    const result = await svc.breakSeal(ULID)
    expect(result.status).toBe('broken')
  })

  it('getSeal returns record or null', async () => {
    const result = await svc.getSeal(ULID)
    expect(result?.sealId).toBe(SEAL_ID)
  })
})

// ── DistributedFinalizationService ───────────────────────────────────────────

describe('DistributedFinalizationService', () => {
  let finalizationRepo: FinalizationRuntimeRepository
  let audit: LockdownAuditRepository
  let bus: RuntimeLockdownEventBus
  let svc: DistributedFinalizationService

  beforeEach(() => {
    const finalization = {
      id: ULID, finalizationId: FINAL_ID, finalizationType: 'epoch' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      finalizationNonce: 'nonce-1', finalizationData: {}, committedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    finalizationRepo = {
      create:       vi.fn().mockResolvedValue(finalization),
      findById:     vi.fn().mockResolvedValue(finalization),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, committedAt?: Date) =>
        Promise.resolve({ ...finalization, status, committedAt: committedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as FinalizationRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new DistributedFinalizationService(finalizationRepo, audit, bus)
  })

  it('startFinalization creates a pending finalization', async () => {
    const result = await svc.startFinalization({
      finalizationType: 'epoch', ownerServerId: 'server-1', finalizationNonce: 'nonce-1',
    })
    expect(result.finalizationId).toBe(FINAL_ID)
    expect(result.status).toBe('pending')
  })

  it('beginCommitting transitions to committing', async () => {
    const result = await svc.beginCommitting(ULID)
    expect(result.status).toBe('committing')
  })

  it('commitFinalization transitions to committed', async () => {
    const result = await svc.commitFinalization(ULID)
    expect(result.status).toBe('committed')
  })

  it('beginRollingBack transitions to rolling_back', async () => {
    const result = await svc.beginRollingBack(ULID)
    expect(result.status).toBe('rolling_back')
  })

  it('rollbackFinalization transitions to rolled_back', async () => {
    const result = await svc.rollbackFinalization(ULID)
    expect(result.status).toBe('rolled_back')
  })

  it('getFinalization returns record or null', async () => {
    const result = await svc.getFinalization(ULID)
    expect(result?.finalizationId).toBe(FINAL_ID)
  })
})

// ── LockdownRecoveryService ───────────────────────────────────────────────────

describe('LockdownRecoveryService', () => {
  let lockdownRepo: RuntimeLockdownRepository
  let integrityRepo: ProductionIntegrityRepository
  let sealRepo: RuntimeSealRepository
  let finalizationRepo: FinalizationRuntimeRepository
  let closureRepo: DeterministicClosureRepository
  let audit: LockdownAuditRepository
  let bus: RuntimeLockdownEventBus
  let svc: LockdownRecoveryService

  beforeEach(() => {
    lockdownRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(7),
    } as unknown as RuntimeLockdownRepository
    integrityRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as ProductionIntegrityRepository
    sealRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as RuntimeSealRepository
    finalizationRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as FinalizationRuntimeRepository
    closureRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as DeterministicClosureRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new LockdownRecoveryService(lockdownRepo, integrityRepo, sealRepo, finalizationRepo, closureRepo, audit, bus)
  })

  it('cleanupStale returns counts for all domains', async () => {
    const result = await svc.cleanupStale(300000)
    expect(result.lockdowns).toBe(7)
    expect(result.integrityChecks).toBe(4)
    expect(result.seals).toBe(2)
    expect(result.finalizations).toBe(3)
    expect(result.closures).toBe(1)
  })
})
