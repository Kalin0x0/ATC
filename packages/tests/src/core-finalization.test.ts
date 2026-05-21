import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CoreFinalizationService,
  DeterministicSealService,
  ProductionCompletionService,
  RuntimeCompletionCoordinator,
  DistributedFinalSealService,
  FinalizationRecoveryService,
} from '@atc/core-finalization-runtime'
import type {
  CoreFinalizationRepository,
  DeterministicSealingRepository,
  RuntimeCompletionRepository,
  ProductionSealRepository,
  FinalizationCoordinationRepository,
  CoreFinalizationAuditRepository,
  CoreFinalizationEventBus,
} from '@atc/core-finalization-runtime'

const ULID             = '01JABCDEFGHJKMNPQRST'
const FINALIZATION_ID  = 'FIN_001'
const SEALING_ID       = 'SEAL_001'
const COMPLETION_ID    = 'COMP_001'
const SEAL_ID          = 'PSEAL_001'
const COORDINATION_ID  = 'COORD_001'
const RESOURCE_ID      = 'RES_001'

function mockAudit(): CoreFinalizationAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as CoreFinalizationAuditRepository
}

function mockBus(): CoreFinalizationEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── CoreFinalizationService ───────────────────────────────────────────────────

describe('CoreFinalizationService', () => {
  let finalizationRepo: CoreFinalizationRepository
  let audit: CoreFinalizationAuditRepository
  let bus: CoreFinalizationEventBus
  let svc: CoreFinalizationService

  beforeEach(() => {
    const finalization = {
      id: ULID, finalizationId: FINALIZATION_ID, finalizationType: 'runtime' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      finalizationNonce: 'nonce-1', finalizationData: {}, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    finalizationRepo = {
      create:       vi.fn().mockResolvedValue(finalization),
      findById:     vi.fn().mockResolvedValue(finalization),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...finalization, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(5),
    } as unknown as CoreFinalizationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new CoreFinalizationService(finalizationRepo, audit, bus)
  })

  it('initiateFinalization creates a pending finalization', async () => {
    const result = await svc.initiateFinalization({
      finalizationType: 'runtime', ownerServerId: 'server-1', finalizationNonce: 'nonce-1',
    })
    expect(result.finalizationId).toBe(FINALIZATION_ID)
    expect(result.status).toBe('pending')
    expect(finalizationRepo.create).toHaveBeenCalledOnce()
  })

  it('activateFinalization transitions to active', async () => {
    const result = await svc.activateFinalization(ULID)
    expect(result.status).toBe('active')
  })

  it('beginCompleting transitions to completing', async () => {
    const result = await svc.beginCompleting(ULID)
    expect(result.status).toBe('completing')
  })

  it('completeFinalization transitions to completed with timestamp', async () => {
    const result = await svc.completeFinalization(ULID)
    expect(result.status).toBe('completed')
    expect(result.completedAt).toBeInstanceOf(Date)
  })

  it('failFinalization transitions to failed', async () => {
    const result = await svc.failFinalization(ULID)
    expect(result.status).toBe('failed')
  })

  it('getFinalization returns record or null', async () => {
    const result = await svc.getFinalization(ULID)
    expect(result?.finalizationId).toBe(FINALIZATION_ID)
  })
})

// ── DeterministicSealService ──────────────────────────────────────────────────

describe('DeterministicSealService', () => {
  let sealingRepo: DeterministicSealingRepository
  let audit: CoreFinalizationAuditRepository
  let bus: CoreFinalizationEventBus
  let svc: DeterministicSealService

  beforeEach(() => {
    const sealing = {
      id: ULID, sealingId: SEALING_ID, sealingType: 'hash' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      sealingNonce: 'nonce-1', sealingData: {}, sealedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    sealingRepo = {
      create:       vi.fn().mockResolvedValue(sealing),
      findById:     vi.fn().mockResolvedValue(sealing),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, sealedAt?: Date) =>
        Promise.resolve({ ...sealing, status, sealedAt: sealedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as DeterministicSealingRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new DeterministicSealService(sealingRepo, audit, bus)
  })

  it('createSealing creates a pending sealing', async () => {
    const result = await svc.createSealing({
      sealingType: 'hash', ownerServerId: 'server-1', sealingNonce: 'nonce-1',
    })
    expect(result.sealingId).toBe(SEALING_ID)
    expect(result.status).toBe('pending')
  })

  it('beginSealing transitions to sealing', async () => {
    const result = await svc.beginSealing(ULID)
    expect(result.status).toBe('sealing')
  })

  it('applySealing transitions to sealed with timestamp', async () => {
    const result = await svc.applySealing(ULID)
    expect(result.status).toBe('sealed')
    expect(result.sealedAt).toBeInstanceOf(Date)
  })

  it('breakSealing transitions to broken', async () => {
    const result = await svc.breakSealing(ULID)
    expect(result.status).toBe('broken')
  })

  it('getSealing returns record or null', async () => {
    const result = await svc.getSealing(ULID)
    expect(result?.sealingId).toBe(SEALING_ID)
  })
})

// ── ProductionCompletionService ───────────────────────────────────────────────

describe('ProductionCompletionService', () => {
  let completionRepo: RuntimeCompletionRepository
  let audit: CoreFinalizationAuditRepository
  let bus: CoreFinalizationEventBus
  let svc: ProductionCompletionService

  beforeEach(() => {
    const completion = {
      id: ULID, completionId: COMPLETION_ID, completionType: 'graceful' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      completionNonce: 'nonce-1', completionData: {}, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    completionRepo = {
      create:       vi.fn().mockResolvedValue(completion),
      findById:     vi.fn().mockResolvedValue(completion),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...completion, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as RuntimeCompletionRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new ProductionCompletionService(completionRepo, audit, bus)
  })

  it('createCompletion creates a pending completion', async () => {
    const result = await svc.createCompletion({
      completionType: 'graceful', ownerServerId: 'server-1', completionNonce: 'nonce-1',
    })
    expect(result.completionId).toBe(COMPLETION_ID)
    expect(result.status).toBe('pending')
  })

  it('progressCompletion transitions to progressing', async () => {
    const result = await svc.progressCompletion(ULID)
    expect(result.status).toBe('progressing')
  })

  it('completeProduction transitions to completed with timestamp', async () => {
    const result = await svc.completeProduction(ULID)
    expect(result.status).toBe('completed')
    expect(result.completedAt).toBeInstanceOf(Date)
  })

  it('abortCompletion transitions to aborted', async () => {
    const result = await svc.abortCompletion(ULID)
    expect(result.status).toBe('aborted')
  })

  it('getCompletion returns record or null', async () => {
    const result = await svc.getCompletion(ULID)
    expect(result?.completionId).toBe(COMPLETION_ID)
  })
})

// ── DistributedFinalSealService ───────────────────────────────────────────────

describe('DistributedFinalSealService', () => {
  let sealRepo: ProductionSealRepository
  let audit: CoreFinalizationAuditRepository
  let bus: CoreFinalizationEventBus
  let svc: DistributedFinalSealService

  beforeEach(() => {
    const seal = {
      id: ULID, sealId: SEAL_ID, sealType: 'permanent' as const,
      status: 'applied' as const, ownerServerId: 'server-1',
      resourceId: RESOURCE_ID, sealNonce: 'nonce-1', sealData: {}, lockedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    sealRepo = {
      create:       vi.fn().mockResolvedValue(seal),
      findById:     vi.fn().mockResolvedValue(seal),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, lockedAt?: Date) =>
        Promise.resolve({ ...seal, status, lockedAt: lockedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as ProductionSealRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new DistributedFinalSealService(sealRepo, audit, bus)
  })

  it('applyFinalSeal creates an applied seal', async () => {
    const result = await svc.applyFinalSeal({
      sealType: 'permanent', ownerServerId: 'server-1',
      resourceId: RESOURCE_ID, sealNonce: 'nonce-1',
    })
    expect(result.sealId).toBe(SEAL_ID)
    expect(result.status).toBe('applied')
    expect(sealRepo.create).toHaveBeenCalledOnce()
  })

  it('lockSeal transitions to locked with timestamp', async () => {
    const result = await svc.lockSeal(ULID)
    expect(result.status).toBe('locked')
    expect(result.lockedAt).toBeInstanceOf(Date)
  })

  it('breakSeal transitions to broken', async () => {
    const result = await svc.breakSeal(ULID)
    expect(result.status).toBe('broken')
  })

  it('expireSeal transitions to expired', async () => {
    const result = await svc.expireSeal(ULID)
    expect(result.status).toBe('expired')
  })

  it('getSeal returns record or null', async () => {
    const result = await svc.getSeal(ULID)
    expect(result?.sealId).toBe(SEAL_ID)
  })
})

// ── RuntimeCompletionCoordinator ──────────────────────────────────────────────

describe('RuntimeCompletionCoordinator', () => {
  let coordinationRepo: FinalizationCoordinationRepository
  let audit: CoreFinalizationAuditRepository
  let bus: CoreFinalizationEventBus
  let svc: RuntimeCompletionCoordinator

  beforeEach(() => {
    const coordination = {
      id: ULID, coordinationId: COORDINATION_ID, coordinationType: 'distributed' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      coordinationData: {}, syncedAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    }
    coordinationRepo = {
      upsert:               vi.fn().mockResolvedValue(coordination),
      findByCoordinationId: vi.fn().mockResolvedValue(coordination),
      updateStatus:         vi.fn().mockImplementation((_id: string, status: string) =>
        Promise.resolve({ ...coordination, status })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as FinalizationCoordinationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeCompletionCoordinator(coordinationRepo, audit, bus)
  })

  it('upsertCoordination creates or updates a coordination record', async () => {
    const result = await svc.upsertCoordination({
      coordinationId: COORDINATION_ID, coordinationType: 'distributed', ownerServerId: 'server-1',
    })
    expect(result.coordinationId).toBe(COORDINATION_ID)
    expect(coordinationRepo.upsert).toHaveBeenCalledOnce()
  })

  it('progressCoordination transitions to completing', async () => {
    const result = await svc.progressCoordination(COORDINATION_ID)
    expect(result.status).toBe('completing')
  })

  it('completeCoordination transitions to completed', async () => {
    const result = await svc.completeCoordination(COORDINATION_ID)
    expect(result.status).toBe('completed')
  })

  it('getCoordination returns record or null', async () => {
    const result = await svc.getCoordination(COORDINATION_ID)
    expect(result?.coordinationId).toBe(COORDINATION_ID)
  })
})

// ── FinalizationRecoveryService ───────────────────────────────────────────────

describe('FinalizationRecoveryService', () => {
  let finalizationRepo: CoreFinalizationRepository
  let completionRepo: RuntimeCompletionRepository
  let sealRepo: ProductionSealRepository
  let coordinationRepo: FinalizationCoordinationRepository
  let sealingRepo: DeterministicSealingRepository
  let audit: CoreFinalizationAuditRepository
  let bus: CoreFinalizationEventBus
  let svc: FinalizationRecoveryService

  beforeEach(() => {
    finalizationRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(8),
    } as unknown as CoreFinalizationRepository
    completionRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(5),
    } as unknown as RuntimeCompletionRepository
    sealRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as ProductionSealRepository
    coordinationRepo = {
      upsert: vi.fn(), findByCoordinationId: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as FinalizationCoordinationRepository
    sealingRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as DeterministicSealingRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new FinalizationRecoveryService(finalizationRepo, completionRepo, sealRepo, coordinationRepo, sealingRepo, audit, bus)
  })

  it('cleanupStale returns counts for all domains', async () => {
    const result = await svc.cleanupStale(300000)
    expect(result.finalizations).toBe(8)
    expect(result.completions).toBe(5)
    expect(result.seals).toBe(3)
    expect(result.coordinations).toBe(2)
    expect(result.sealings).toBe(4)
  })
})
