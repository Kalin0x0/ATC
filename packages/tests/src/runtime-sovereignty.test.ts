import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RuntimeSovereigntyService,
  InfiniteClusterContinuityService,
  AutonomousFinalizationService,
  RuntimeSuccessionService,
  DistributedSovereigntyCoordinator,
  SovereigntyRecoveryService,
} from '@atc/runtime-sovereignty'
import type {
  RuntimeSovereigntyRepository,
  ClusterContinuityRepository,
  AutonomousFinalizationRepository,
  RuntimeSuccessionRepository,
  SovereigntyCoordinationRepository,
  SovereigntyAuditRepository,
  SovereigntyRuntimeEventBus,
} from '@atc/runtime-sovereignty'

const ULID             = '01JABCDEFGHJKMNPQRST'
const SOVEREIGNTY_ID   = 'SOV_001'
const CLUSTER_ID       = 'CLUS_001'
const FINALIZATION_ID  = 'FINAL_001'
const SUCCESSION_ID    = 'SUCC_001'
const COORDINATION_ID  = 'COORD_001'

function mockAudit(): SovereigntyAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as SovereigntyAuditRepository
}

function mockBus(): SovereigntyRuntimeEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── RuntimeSovereigntyService ─────────────────────────────────────────────────

describe('RuntimeSovereigntyService', () => {
  let sovereigntyRepo: RuntimeSovereigntyRepository
  let audit: SovereigntyAuditRepository
  let bus: SovereigntyRuntimeEventBus
  let svc: RuntimeSovereigntyService

  beforeEach(() => {
    const sovereignty = {
      id: ULID, sovereigntyId: SOVEREIGNTY_ID, sovereigntyType: 'absolute' as const,
      status: 'establishing' as const, ownerServerId: 'server-1',
      sovereigntyNonce: 'nonce-1', sovereigntyData: {}, establishedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    sovereigntyRepo = {
      create:       vi.fn().mockResolvedValue(sovereignty),
      findById:     vi.fn().mockResolvedValue(sovereignty),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, establishedAt?: Date) =>
        Promise.resolve({ ...sovereignty, status, establishedAt: establishedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as RuntimeSovereigntyRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeSovereigntyService(sovereigntyRepo, audit, bus)
  })

  it('establishSovereignty creates an establishing sovereignty', async () => {
    const result = await svc.establishSovereignty({
      sovereigntyType: 'absolute', ownerServerId: 'server-1', sovereigntyNonce: 'nonce-1',
    })
    expect(result.sovereigntyId).toBe(SOVEREIGNTY_ID)
    expect(result.status).toBe('establishing')
    expect(sovereigntyRepo.create).toHaveBeenCalledOnce()
  })

  it('confirmSovereignty transitions to established with timestamp', async () => {
    const result = await svc.confirmSovereignty(ULID)
    expect(result.status).toBe('established')
    expect(result.establishedAt).toBeInstanceOf(Date)
  })

  it('challengeSovereignty transitions to challenged', async () => {
    const result = await svc.challengeSovereignty(ULID)
    expect(result.status).toBe('challenged')
  })

  it('revokeSovereignty transitions to revoked', async () => {
    const result = await svc.revokeSovereignty(ULID)
    expect(result.status).toBe('revoked')
  })

  it('expireSovereignty transitions to expired', async () => {
    const result = await svc.expireSovereignty(ULID)
    expect(result.status).toBe('expired')
  })

  it('getSovereignty returns record or null', async () => {
    const result = await svc.getSovereignty(ULID)
    expect(result?.sovereigntyId).toBe(SOVEREIGNTY_ID)
  })
})

// ── InfiniteClusterContinuityService ─────────────────────────────────────────

describe('InfiniteClusterContinuityService', () => {
  let clusterRepo: ClusterContinuityRepository
  let audit: SovereigntyAuditRepository
  let bus: SovereigntyRuntimeEventBus
  let svc: InfiniteClusterContinuityService

  beforeEach(() => {
    const cluster = {
      id: ULID, clusterId: CLUSTER_ID, clusterType: 'primary' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      clusterData: {}, syncedAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    }
    clusterRepo = {
      upsert:          vi.fn().mockResolvedValue(cluster),
      findByClusterId: vi.fn().mockResolvedValue(cluster),
      updateStatus:    vi.fn().mockImplementation((_id: string, status: string) =>
        Promise.resolve({ ...cluster, status })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as ClusterContinuityRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new InfiniteClusterContinuityService(clusterRepo, audit, bus)
  })

  it('registerCluster creates or updates a cluster record', async () => {
    const result = await svc.registerCluster({
      clusterId: CLUSTER_ID, clusterType: 'primary', ownerServerId: 'server-1',
    })
    expect(result.clusterId).toBe(CLUSTER_ID)
    expect(clusterRepo.upsert).toHaveBeenCalledOnce()
  })

  it('degradeCluster transitions to degraded', async () => {
    const result = await svc.degradeCluster(CLUSTER_ID)
    expect(result.status).toBe('degraded')
  })

  it('recoverCluster transitions to recovering', async () => {
    const result = await svc.recoverCluster(CLUSTER_ID)
    expect(result.status).toBe('recovering')
  })

  it('failCluster transitions to failed', async () => {
    const result = await svc.failCluster(CLUSTER_ID)
    expect(result.status).toBe('failed')
  })

  it('getCluster returns record or null', async () => {
    const result = await svc.getCluster(CLUSTER_ID)
    expect(result?.clusterId).toBe(CLUSTER_ID)
  })
})

// ── AutonomousFinalizationService ─────────────────────────────────────────────

describe('AutonomousFinalizationService', () => {
  let finalizationRepo: AutonomousFinalizationRepository
  let audit: SovereigntyAuditRepository
  let bus: SovereigntyRuntimeEventBus
  let svc: AutonomousFinalizationService

  beforeEach(() => {
    const finalization = {
      id: ULID, finalizationId: FINALIZATION_ID, finalizationType: 'epoch' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      finalizationNonce: 'nonce-1', finalizationData: {}, finalizedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    finalizationRepo = {
      create:       vi.fn().mockResolvedValue(finalization),
      findById:     vi.fn().mockResolvedValue(finalization),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, finalizedAt?: Date) =>
        Promise.resolve({ ...finalization, status, finalizedAt: finalizedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as AutonomousFinalizationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new AutonomousFinalizationService(finalizationRepo, audit, bus)
  })

  it('initiateFinalization creates a pending finalization', async () => {
    const result = await svc.initiateFinalization({
      finalizationType: 'epoch', ownerServerId: 'server-1', finalizationNonce: 'nonce-1',
    })
    expect(result.finalizationId).toBe(FINALIZATION_ID)
    expect(result.status).toBe('pending')
  })

  it('processFinalization transitions to processing', async () => {
    const result = await svc.processFinalization(ULID)
    expect(result.status).toBe('processing')
  })

  it('completeFinalization transitions to finalized with timestamp', async () => {
    const result = await svc.completeFinalization(ULID)
    expect(result.status).toBe('finalized')
    expect(result.finalizedAt).toBeInstanceOf(Date)
  })

  it('abortFinalization transitions to aborted', async () => {
    const result = await svc.abortFinalization(ULID)
    expect(result.status).toBe('aborted')
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

// ── RuntimeSuccessionService ──────────────────────────────────────────────────

describe('RuntimeSuccessionService', () => {
  let successionRepo: RuntimeSuccessionRepository
  let audit: SovereigntyAuditRepository
  let bus: SovereigntyRuntimeEventBus
  let svc: RuntimeSuccessionService

  beforeEach(() => {
    const succession = {
      id: ULID, successionId: SUCCESSION_ID, successionType: 'planned' as const,
      status: 'pending' as const, ownerServerId: 'server-1', targetServerId: null,
      successionNonce: 'nonce-1', successionData: {}, transferredAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    successionRepo = {
      create:       vi.fn().mockResolvedValue(succession),
      findById:     vi.fn().mockResolvedValue(succession),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, transferredAt?: Date) =>
        Promise.resolve({ ...succession, status, transferredAt: transferredAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as RuntimeSuccessionRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeSuccessionService(successionRepo, audit, bus)
  })

  it('initiateSuccession creates a pending succession', async () => {
    const result = await svc.initiateSuccession({
      successionType: 'planned', ownerServerId: 'server-1', successionNonce: 'nonce-1',
    })
    expect(result.successionId).toBe(SUCCESSION_ID)
    expect(result.status).toBe('pending')
  })

  it('beginTransfer transitions to transferring', async () => {
    const result = await svc.beginTransfer(ULID)
    expect(result.status).toBe('transferring')
  })

  it('completeSuccession transitions to completed with timestamp', async () => {
    const result = await svc.completeSuccession(ULID)
    expect(result.status).toBe('completed')
    expect(result.transferredAt).toBeInstanceOf(Date)
  })

  it('failSuccession transitions to failed', async () => {
    const result = await svc.failSuccession(ULID)
    expect(result.status).toBe('failed')
  })

  it('revertSuccession transitions to reverted', async () => {
    const result = await svc.revertSuccession(ULID)
    expect(result.status).toBe('reverted')
  })

  it('getSuccession returns record or null', async () => {
    const result = await svc.getSuccession(ULID)
    expect(result?.successionId).toBe(SUCCESSION_ID)
  })
})

// ── DistributedSovereigntyCoordinator ────────────────────────────────────────

describe('DistributedSovereigntyCoordinator', () => {
  let coordinationRepo: SovereigntyCoordinationRepository
  let audit: SovereigntyAuditRepository
  let bus: SovereigntyRuntimeEventBus
  let svc: DistributedSovereigntyCoordinator

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
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as SovereigntyCoordinationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new DistributedSovereigntyCoordinator(coordinationRepo, audit, bus)
  })

  it('upsertCoordination creates or updates a coordination record', async () => {
    const result = await svc.upsertCoordination({
      coordinationId: COORDINATION_ID, coordinationType: 'distributed', ownerServerId: 'server-1',
    })
    expect(result.coordinationId).toBe(COORDINATION_ID)
    expect(coordinationRepo.upsert).toHaveBeenCalledOnce()
  })

  it('suspendCoordination transitions to suspended', async () => {
    const result = await svc.suspendCoordination(COORDINATION_ID)
    expect(result.status).toBe('suspended')
  })

  it('expireCoordination transitions to expired', async () => {
    const result = await svc.expireCoordination(COORDINATION_ID)
    expect(result.status).toBe('expired')
  })

  it('getCoordination returns record or null', async () => {
    const result = await svc.getCoordination(COORDINATION_ID)
    expect(result?.coordinationId).toBe(COORDINATION_ID)
  })
})

// ── SovereigntyRecoveryService ────────────────────────────────────────────────

describe('SovereigntyRecoveryService', () => {
  let sovereigntyRepo: RuntimeSovereigntyRepository
  let clusterRepo: ClusterContinuityRepository
  let finalizationRepo: AutonomousFinalizationRepository
  let successionRepo: RuntimeSuccessionRepository
  let coordinationRepo: SovereigntyCoordinationRepository
  let audit: SovereigntyAuditRepository
  let bus: SovereigntyRuntimeEventBus
  let svc: SovereigntyRecoveryService

  beforeEach(() => {
    sovereigntyRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(6),
    } as unknown as RuntimeSovereigntyRepository
    clusterRepo = {
      upsert: vi.fn(), findByClusterId: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as ClusterContinuityRepository
    finalizationRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as AutonomousFinalizationRepository
    successionRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as RuntimeSuccessionRepository
    coordinationRepo = {
      upsert: vi.fn(), findByCoordinationId: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as SovereigntyCoordinationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new SovereigntyRecoveryService(sovereigntyRepo, clusterRepo, finalizationRepo, successionRepo, coordinationRepo, audit, bus)
  })

  it('cleanupStale returns counts for all domains', async () => {
    const result = await svc.cleanupStale(300000)
    expect(result.sovereignties).toBe(6)
    expect(result.clusterNodes).toBe(4)
    expect(result.finalizations).toBe(3)
    expect(result.successions).toBe(2)
    expect(result.coordinations).toBe(1)
  })
})
