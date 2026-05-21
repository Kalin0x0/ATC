import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  EvolutionRuntimeService,
  AdaptiveOptimizationService,
  RuntimeTuningService,
  AutonomousEvolutionService,
  DistributedOptimizationService,
  EvolutionRecoveryService,
} from '@atc/evolution-runtime'
import type {
  RuntimeEvolutionRepository,
  AdaptiveOptimizationRepository,
  RuntimeTuningRepository,
  AutonomousEvolutionRepository,
  DistributedOptimizationRepository,
  EvolutionAuditRepository,
  EvolutionRuntimeEventBus,
} from '@atc/evolution-runtime'

const ULID           = '01JABCDEFGHJKMNPQRST'
const EVOLUTION_ID   = 'EVO_001'
const OPT_ID         = 'OPT_001'
const ENTITY_ID      = 'ENTITY_001'
const AUTO_ID        = 'AUTO_001'
const NODE_ID        = 'NODE_001'

function mockAudit(): EvolutionAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as EvolutionAuditRepository
}

function mockBus(): EvolutionRuntimeEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── EvolutionRuntimeService ──────────────────────────────────────────────────

describe('EvolutionRuntimeService', () => {
  let evolutionRepo: RuntimeEvolutionRepository
  let audit: EvolutionAuditRepository
  let bus: EvolutionRuntimeEventBus
  let svc: EvolutionRuntimeService

  beforeEach(() => {
    const evolution = {
      id: ULID, evolutionId: EVOLUTION_ID, evolutionType: 'schema' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      evolutionNonce: 'nonce-1', evolutionData: {}, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    evolutionRepo = {
      create:       vi.fn().mockResolvedValue(evolution),
      findById:     vi.fn().mockResolvedValue(evolution),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...evolution, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as RuntimeEvolutionRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new EvolutionRuntimeService(evolutionRepo, audit, bus)
  })

  it('startEvolution creates a pending evolution', async () => {
    const result = await svc.startEvolution({
      evolutionType: 'schema', ownerServerId: 'server-1', evolutionNonce: 'nonce-1',
    })
    expect(result.evolutionId).toBe(EVOLUTION_ID)
    expect(result.status).toBe('pending')
    expect(evolutionRepo.create).toHaveBeenCalledOnce()
  })

  it('activateEvolution transitions to active', async () => {
    const result = await svc.activateEvolution(ULID)
    expect(result.status).toBe('active')
  })

  it('completeEvolution transitions to completed', async () => {
    const result = await svc.completeEvolution(ULID)
    expect(result.status).toBe('completed')
  })

  it('failEvolution transitions to failed', async () => {
    const result = await svc.failEvolution(ULID)
    expect(result.status).toBe('failed')
  })

  it('rollbackEvolution transitions to rolled_back', async () => {
    const result = await svc.rollbackEvolution(ULID)
    expect(result.status).toBe('rolled_back')
  })

  it('getEvolution returns evolution or null', async () => {
    const result = await svc.getEvolution(ULID)
    expect(result?.evolutionId).toBe(EVOLUTION_ID)
  })
})

// ── AdaptiveOptimizationService ──────────────────────────────────────────────

describe('AdaptiveOptimizationService', () => {
  let optimizationRepo: AdaptiveOptimizationRepository
  let audit: EvolutionAuditRepository
  let bus: EvolutionRuntimeEventBus
  let svc: AdaptiveOptimizationService

  beforeEach(() => {
    const optimization = {
      id: ULID, optimizationId: OPT_ID, optimizationType: 'memory' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      targetNode: NODE_ID, optimizationNonce: 'nonce-1',
      optimizationData: {}, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    optimizationRepo = {
      create:       vi.fn().mockResolvedValue(optimization),
      findById:     vi.fn().mockResolvedValue(optimization),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...optimization, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as AdaptiveOptimizationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new AdaptiveOptimizationService(optimizationRepo, audit, bus)
  })

  it('startOptimization creates a pending optimization', async () => {
    const result = await svc.startOptimization({
      optimizationType: 'memory', ownerServerId: 'server-1',
      targetNode: NODE_ID, optimizationNonce: 'nonce-1',
    })
    expect(result.optimizationId).toBe(OPT_ID)
    expect(result.status).toBe('pending')
  })

  it('completeOptimization transitions to completed', async () => {
    const result = await svc.completeOptimization(ULID)
    expect(result.status).toBe('completed')
  })

  it('failOptimization transitions to failed', async () => {
    const result = await svc.failOptimization(ULID)
    expect(result.status).toBe('failed')
  })

  it('getOptimization returns optimization or null', async () => {
    const result = await svc.getOptimization(ULID)
    expect(result?.optimizationId).toBe(OPT_ID)
  })
})

// ── RuntimeTuningService ─────────────────────────────────────────────────────

describe('RuntimeTuningService', () => {
  let tuningRepo: RuntimeTuningRepository
  let audit: EvolutionAuditRepository
  let bus: EvolutionRuntimeEventBus
  let svc: RuntimeTuningService

  beforeEach(() => {
    const tuning = {
      id: ULID, entityId: ENTITY_ID, tuningType: 'threshold' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      tuningData: {}, appliedAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    }
    tuningRepo = {
      upsert:       vi.fn().mockResolvedValue(tuning),
      findByEntity: vi.fn().mockResolvedValue(tuning),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as RuntimeTuningRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeTuningService(tuningRepo, audit, bus)
  })

  it('upsertTuning upserts tuning record', async () => {
    const result = await svc.upsertTuning({
      entityId: ENTITY_ID, tuningType: 'threshold', ownerServerId: 'server-1',
    })
    expect(result.entityId).toBe(ENTITY_ID)
    expect(tuningRepo.upsert).toHaveBeenCalledOnce()
  })

  it('getTuning returns tuning or null', async () => {
    const result = await svc.getTuning(ENTITY_ID)
    expect(result?.entityId).toBe(ENTITY_ID)
  })
})

// ── AutonomousEvolutionService ───────────────────────────────────────────────

describe('AutonomousEvolutionService', () => {
  let autonomousRepo: AutonomousEvolutionRepository
  let audit: EvolutionAuditRepository
  let bus: EvolutionRuntimeEventBus
  let svc: AutonomousEvolutionService

  beforeEach(() => {
    const autonomous = {
      id: ULID, autonomousId: AUTO_ID, autonomousType: 'self_heal' as const,
      status: 'triggered' as const, ownerServerId: 'server-1',
      autonomousNonce: 'nonce-1', triggerData: {}, outcomeData: null, appliedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    autonomousRepo = {
      create:       vi.fn().mockResolvedValue(autonomous),
      findById:     vi.fn().mockResolvedValue(autonomous),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, appliedAt?: Date) =>
        Promise.resolve({ ...autonomous, status, appliedAt: appliedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as AutonomousEvolutionRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new AutonomousEvolutionService(autonomousRepo, audit, bus)
  })

  it('triggerEvolution creates a triggered autonomous evolution', async () => {
    const result = await svc.triggerEvolution({
      autonomousType: 'self_heal', ownerServerId: 'server-1', autonomousNonce: 'nonce-1',
    })
    expect(result.autonomousId).toBe(AUTO_ID)
    expect(result.status).toBe('triggered')
  })

  it('applyEvolution transitions to applied', async () => {
    const result = await svc.applyEvolution(ULID)
    expect(result.status).toBe('applied')
  })

  it('revertEvolution transitions to reverted', async () => {
    const result = await svc.revertEvolution(ULID)
    expect(result.status).toBe('reverted')
  })

  it('getEvolution returns evolution or null', async () => {
    const result = await svc.getEvolution(ULID)
    expect(result?.autonomousId).toBe(AUTO_ID)
  })
})

// ── DistributedOptimizationService ──────────────────────────────────────────

describe('DistributedOptimizationService', () => {
  let distOptRepo: DistributedOptimizationRepository
  let audit: EvolutionAuditRepository
  let bus: EvolutionRuntimeEventBus
  let svc: DistributedOptimizationService

  beforeEach(() => {
    const distOpt = {
      id: ULID, nodeId: NODE_ID, optType: 'load_balance' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      optData: {}, lastOptimizedAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    }
    distOptRepo = {
      upsert:      vi.fn().mockResolvedValue(distOpt),
      findByNode:  vi.fn().mockResolvedValue(distOpt),
      failNode:    vi.fn().mockResolvedValue(undefined),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as DistributedOptimizationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new DistributedOptimizationService(distOptRepo, audit, bus)
  })

  it('upsertOptimization upserts distributed opt record', async () => {
    const result = await svc.upsertOptimization({
      nodeId: NODE_ID, optType: 'load_balance', ownerServerId: 'server-1',
    })
    expect(result.nodeId).toBe(NODE_ID)
    expect(distOptRepo.upsert).toHaveBeenCalledOnce()
  })

  it('failNode calls failNode on repo', async () => {
    await svc.failNode(NODE_ID)
    expect(distOptRepo.failNode).toHaveBeenCalledWith(NODE_ID)
  })

  it('getOptimization returns record or null', async () => {
    const result = await svc.getOptimization(NODE_ID)
    expect(result?.nodeId).toBe(NODE_ID)
  })
})

// ── EvolutionRecoveryService ─────────────────────────────────────────────────

describe('EvolutionRecoveryService', () => {
  let evolutionRepo: RuntimeEvolutionRepository
  let optimizationRepo: AdaptiveOptimizationRepository
  let tuningRepo: RuntimeTuningRepository
  let autonomousRepo: AutonomousEvolutionRepository
  let audit: EvolutionAuditRepository
  let bus: EvolutionRuntimeEventBus
  let svc: EvolutionRecoveryService

  beforeEach(() => {
    evolutionRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(6),
    } as unknown as RuntimeEvolutionRepository
    optimizationRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as AdaptiveOptimizationRepository
    tuningRepo = {
      upsert: vi.fn(), findByEntity: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as RuntimeTuningRepository
    autonomousRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as AutonomousEvolutionRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new EvolutionRecoveryService(evolutionRepo, optimizationRepo, tuningRepo, autonomousRepo, audit, bus)
  })

  it('cleanupStale returns counts for evolutions, optimizations, tunings, autonomousEvolutions', async () => {
    const result = await svc.cleanupStale(300000)
    expect(result.evolutions).toBe(6)
    expect(result.optimizations).toBe(4)
    expect(result.tunings).toBe(2)
    expect(result.autonomousEvolutions).toBe(1)
  })
})
