import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MetaRuntimeService,
  AutonomousHealingService,
  DistributedRepairService,
  MetaAllocationService,
  RuntimeCoordinationService,
  SelfHealingRecoveryService,
} from '@atc/meta-runtime'
import type {
  MetaRuntimeRepository,
  HealingOperationRepository,
  DistributedRepairRepository,
  MetaAllocationRepository,
  RuntimeCoordinationRepository,
  MetaAuditRepository,
  MetaRuntimeEventBus,
} from '@atc/meta-runtime'

const ULID        = '01JABCDEFGHJKMNPQRST'
const META_ID     = 'META_001'
const HEALING_ID  = 'HEAL_001'
const REPAIR_ID   = 'REP_001'
const ENTITY_ID   = 'ENTITY_001'
const NODE_ID     = 'NODE_001'

function mockAudit(): MetaAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as MetaAuditRepository
}

function mockBus(): MetaRuntimeEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── MetaRuntimeService ───────────────────────────────────────────────────────

describe('MetaRuntimeService', () => {
  let metaRepo: MetaRuntimeRepository
  let audit: MetaAuditRepository
  let bus: MetaRuntimeEventBus
  let svc: MetaRuntimeService

  beforeEach(() => {
    const meta = {
      id: ULID, metaId: META_ID, metaType: 'orchestrator' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      metaNonce: 'nonce-1', metaData: {},
      createdAt: new Date(), updatedAt: new Date(),
    }
    metaRepo = {
      create:       vi.fn().mockResolvedValue(meta),
      findById:     vi.fn().mockResolvedValue(meta),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string) =>
        Promise.resolve({ ...meta, status })
      ),
      listActive:   vi.fn().mockResolvedValue([meta]),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as MetaRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new MetaRuntimeService(metaRepo, audit, bus)
  })

  it('registerMeta creates an active meta runtime', async () => {
    const result = await svc.registerMeta({
      metaType: 'orchestrator', ownerServerId: 'server-1', metaNonce: 'nonce-1',
    })
    expect(result.metaId).toBe(META_ID)
    expect(result.status).toBe('active')
    expect(metaRepo.create).toHaveBeenCalledOnce()
  })

  it('pauseMeta transitions to paused', async () => {
    const result = await svc.pauseMeta(ULID)
    expect(result.status).toBe('paused')
  })

  it('terminateMeta transitions to terminated', async () => {
    const result = await svc.terminateMeta(ULID)
    expect(result.status).toBe('terminated')
  })

  it('getMeta returns meta or null', async () => {
    const result = await svc.getMeta(ULID)
    expect(result?.metaId).toBe(META_ID)
  })

  it('listActiveMeta returns array', async () => {
    const result = await svc.listActiveMeta()
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
  })
})

// ── AutonomousHealingService ─────────────────────────────────────────────────

describe('AutonomousHealingService', () => {
  let healingRepo: HealingOperationRepository
  let audit: MetaAuditRepository
  let bus: MetaRuntimeEventBus
  let svc: AutonomousHealingService

  beforeEach(() => {
    const healing = {
      id: ULID, healingId: HEALING_ID, healingType: 'restart' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      targetNode: NODE_ID, healingNonce: 'nonce-1',
      healingData: {}, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    healingRepo = {
      create:       vi.fn().mockResolvedValue(healing),
      findById:     vi.fn().mockResolvedValue(healing),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...healing, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as HealingOperationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new AutonomousHealingService(healingRepo, audit, bus)
  })

  it('startHealing creates a pending healing operation', async () => {
    const result = await svc.startHealing({
      healingType: 'restart', ownerServerId: 'server-1',
      targetNode: NODE_ID, healingNonce: 'nonce-1',
    })
    expect(result.healingId).toBe(HEALING_ID)
    expect(result.status).toBe('pending')
  })

  it('completeHealing transitions to completed', async () => {
    const result = await svc.completeHealing(ULID)
    expect(result.status).toBe('completed')
  })

  it('failHealing transitions to failed', async () => {
    const result = await svc.failHealing(ULID)
    expect(result.status).toBe('failed')
  })

  it('getHealing returns healing or null', async () => {
    const result = await svc.getHealing(ULID)
    expect(result?.healingId).toBe(HEALING_ID)
  })
})

// ── DistributedRepairService ─────────────────────────────────────────────────

describe('DistributedRepairService', () => {
  let repairRepo: DistributedRepairRepository
  let audit: MetaAuditRepository
  let bus: MetaRuntimeEventBus
  let svc: DistributedRepairService

  beforeEach(() => {
    const repair = {
      id: ULID, repairId: REPAIR_ID, repairType: 'data_repair' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      targetNode: NODE_ID, repairNonce: 'nonce-1',
      repairData: {}, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    repairRepo = {
      create:       vi.fn().mockResolvedValue(repair),
      findById:     vi.fn().mockResolvedValue(repair),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...repair, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as DistributedRepairRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new DistributedRepairService(repairRepo, audit, bus)
  })

  it('startRepair creates a pending repair', async () => {
    const result = await svc.startRepair({
      repairType: 'data_repair', ownerServerId: 'server-1',
      targetNode: NODE_ID, repairNonce: 'nonce-1',
    })
    expect(result.repairId).toBe(REPAIR_ID)
    expect(result.status).toBe('pending')
  })

  it('completeRepair transitions to completed', async () => {
    const result = await svc.completeRepair(ULID)
    expect(result.status).toBe('completed')
  })

  it('failRepair transitions to failed', async () => {
    const result = await svc.failRepair(ULID)
    expect(result.status).toBe('failed')
  })

  it('getRepair returns repair or null', async () => {
    const result = await svc.getRepair(ULID)
    expect(result?.repairId).toBe(REPAIR_ID)
  })
})

// ── MetaAllocationService ────────────────────────────────────────────────────

describe('MetaAllocationService', () => {
  let allocationRepo: MetaAllocationRepository
  let audit: MetaAuditRepository
  let bus: MetaRuntimeEventBus
  let svc: MetaAllocationService

  beforeEach(() => {
    const allocation = {
      id: ULID, entityId: ENTITY_ID, allocationType: 'compute' as const,
      status: 'allocated' as const, ownerServerId: 'server-1',
      allocationData: {}, createdAt: new Date(), updatedAt: new Date(),
    }
    allocationRepo = {
      upsert:         vi.fn().mockResolvedValue(allocation),
      findByEntity:   vi.fn().mockResolvedValue(allocation),
      release:        vi.fn().mockResolvedValue(undefined),
      cleanupReleased: vi.fn().mockResolvedValue(0),
    } as unknown as MetaAllocationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new MetaAllocationService(allocationRepo, audit, bus)
  })

  it('allocate upserts allocation record', async () => {
    const result = await svc.allocate({
      entityId: ENTITY_ID, allocationType: 'compute', ownerServerId: 'server-1',
    })
    expect(result.entityId).toBe(ENTITY_ID)
    expect(allocationRepo.upsert).toHaveBeenCalledOnce()
  })

  it('release calls release on the repo', async () => {
    await svc.release(ENTITY_ID)
    expect(allocationRepo.release).toHaveBeenCalledWith(ENTITY_ID)
  })

  it('getAllocation returns allocation or null', async () => {
    const result = await svc.getAllocation(ENTITY_ID)
    expect(result?.entityId).toBe(ENTITY_ID)
  })
})

// ── RuntimeCoordinationService ───────────────────────────────────────────────

describe('RuntimeCoordinationService', () => {
  let coordinationRepo: RuntimeCoordinationRepository
  let audit: MetaAuditRepository
  let bus: MetaRuntimeEventBus
  let svc: RuntimeCoordinationService

  beforeEach(() => {
    const coordination = {
      id: ULID, nodeId: NODE_ID, coordinationType: 'leader' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      coordinationData: {}, heartbeatAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    }
    coordinationRepo = {
      upsert:      vi.fn().mockResolvedValue(coordination),
      findByNode:  vi.fn().mockResolvedValue(coordination),
      failNode:    vi.fn().mockResolvedValue(undefined),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as RuntimeCoordinationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeCoordinationService(coordinationRepo, audit, bus)
  })

  it('upsertCoordination upserts coordination record', async () => {
    const result = await svc.upsertCoordination({
      nodeId: NODE_ID, coordinationType: 'leader', ownerServerId: 'server-1',
    })
    expect(result.nodeId).toBe(NODE_ID)
    expect(coordinationRepo.upsert).toHaveBeenCalledOnce()
  })

  it('failNode calls failNode on the repo', async () => {
    await svc.failNode(NODE_ID)
    expect(coordinationRepo.failNode).toHaveBeenCalledWith(NODE_ID)
  })

  it('getCoordination returns coordination or null', async () => {
    const result = await svc.getCoordination(NODE_ID)
    expect(result?.nodeId).toBe(NODE_ID)
  })
})

// ── SelfHealingRecoveryService ───────────────────────────────────────────────

describe('SelfHealingRecoveryService', () => {
  let metaRepo: MetaRuntimeRepository
  let healingRepo: HealingOperationRepository
  let repairRepo: DistributedRepairRepository
  let allocationRepo: MetaAllocationRepository
  let audit: MetaAuditRepository
  let bus: MetaRuntimeEventBus
  let svc: SelfHealingRecoveryService

  beforeEach(() => {
    metaRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      listActive: vi.fn(), cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as MetaRuntimeRepository
    healingRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as HealingOperationRepository
    repairRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as DistributedRepairRepository
    allocationRepo = {
      upsert: vi.fn(), findByEntity: vi.fn(), release: vi.fn(),
      cleanupReleased: vi.fn().mockResolvedValue(1),
    } as unknown as MetaAllocationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new SelfHealingRecoveryService(metaRepo, healingRepo, repairRepo, allocationRepo, audit, bus)
  })

  it('cleanupStale returns counts for metas, healings, repairs, allocations', async () => {
    const result = await svc.cleanupStale(300000)
    expect(result.metas).toBe(4)
    expect(result.healings).toBe(3)
    expect(result.repairs).toBe(2)
    expect(result.allocations).toBe(1)
  })
})
