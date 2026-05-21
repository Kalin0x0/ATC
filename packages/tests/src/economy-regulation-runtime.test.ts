import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  EconomyRegulationService,
  ResourceBalancingService,
  InflationControlService,
  AutonomousTaxAdjustmentService,
  MarketStabilizationService,
  EconomicRecoveryService,
} from '@atc/economy-regulation-runtime'
import type {
  EconomyRegulationRepository,
  ResourceBalancingRepository,
  MarketStabilizationRepository,
  TaxRuntimeRepository,
  InflationRuntimeRepository,
  EconomyAuditRepository,
  EconomyRegulationEventBus,
} from '@atc/economy-regulation-runtime'

const ULID              = '01JABCDEFGHJKMNPQRST'
const REGULATION_ID     = 'REG_001'
const BALANCING_ID      = 'BAL_001'
const STABILIZATION_ID  = 'STAB_001'
const REGION_ID         = 'REGION_001'

function mockAudit(): EconomyAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as EconomyAuditRepository
}

function mockBus(): EconomyRegulationEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── EconomyRegulationService ─────────────────────────────────────────────────

describe('EconomyRegulationService', () => {
  let regulationRepo: EconomyRegulationRepository
  let audit: EconomyAuditRepository
  let bus: EconomyRegulationEventBus
  let svc: EconomyRegulationService

  beforeEach(() => {
    const regulation = {
      id: ULID, regulationId: REGULATION_ID, regulationType: 'price_ceiling' as const,
      status: 'active' as const, ownerServerId: 'server-1', regulationNonce: 'nonce-1',
      regionId: REGION_ID, expiresAt: null,
      createdAt: new Date(), updatedAt: new Date(), regulationData: '{}',
    }
    regulationRepo = {
      create:       vi.fn().mockResolvedValue(regulation),
      findById:     vi.fn().mockResolvedValue(regulation),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string) =>
        Promise.resolve({ ...regulation, status })
      ),
      listActive:   vi.fn().mockResolvedValue([regulation]),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as EconomyRegulationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new EconomyRegulationService(regulationRepo, audit, bus)
  })

  it('createRegulation creates an active regulation', async () => {
    const result = await svc.createRegulation({
      regulationType: 'price_ceiling', ownerServerId: 'server-1',
      regulationNonce: 'nonce-1', regionId: REGION_ID,
    })
    expect(result.regulationId).toBe(REGULATION_ID)
    expect(result.status).toBe('active')
    expect(regulationRepo.create).toHaveBeenCalledOnce()
  })

  it('suspendRegulation transitions to suspended', async () => {
    const result = await svc.suspendRegulation(ULID)
    expect(result.status).toBe('suspended')
    expect(regulationRepo.updateStatus).toHaveBeenCalledWith(ULID, 'suspended')
  })

  it('getRegulation returns regulation or null', async () => {
    const result = await svc.getRegulation(ULID)
    expect(result?.regulationId).toBe(REGULATION_ID)
  })

  it('listActiveRegulations returns array', async () => {
    const result = await svc.listActiveRegulations()
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
  })
})

// ── ResourceBalancingService ─────────────────────────────────────────────────

describe('ResourceBalancingService', () => {
  let balancingRepo: ResourceBalancingRepository
  let audit: EconomyAuditRepository
  let bus: EconomyRegulationEventBus
  let svc: ResourceBalancingService

  beforeEach(() => {
    const balancing = {
      id: ULID, balancingId: BALANCING_ID, resourceType: 'goods' as const,
      status: 'pending' as const, ownerServerId: 'server-1', balancingNonce: 'nonce-1',
      targetRegionId: REGION_ID, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(), balancingData: {},
    }
    balancingRepo = {
      create:       vi.fn().mockResolvedValue(balancing),
      findById:     vi.fn().mockResolvedValue(balancing),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...balancing, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as ResourceBalancingRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new ResourceBalancingService(balancingRepo, audit, bus)
  })

  it('startBalancing creates a pending balancing', async () => {
    const result = await svc.startBalancing({
      resourceType: 'goods', ownerServerId: 'server-1',
      balancingNonce: 'nonce-1', targetRegionId: REGION_ID,
    })
    expect(result.balancingId).toBe(BALANCING_ID)
    expect(result.status).toBe('pending')
  })

  it('completeBalancing transitions to completed', async () => {
    const result = await svc.completeBalancing(ULID)
    expect(result.status).toBe('completed')
  })

  it('failBalancing transitions to failed', async () => {
    const result = await svc.failBalancing(ULID)
    expect(result.status).toBe('failed')
  })

  it('getBalancing returns balancing or null', async () => {
    const result = await svc.getBalancing(ULID)
    expect(result?.balancingId).toBe(BALANCING_ID)
  })
})

// ── InflationControlService ──────────────────────────────────────────────────

describe('InflationControlService', () => {
  let inflationRepo: InflationRuntimeRepository
  let audit: EconomyAuditRepository
  let bus: EconomyRegulationEventBus
  let svc: InflationControlService

  beforeEach(() => {
    const inflation = {
      id: ULID, regionId: REGION_ID, inflationRate: '0.0250',
      status: 'active' as const, ownerServerId: 'server-1',
      measuredAt: new Date(), createdAt: new Date(), updatedAt: new Date(), inflationData: '{}',
    }
    inflationRepo = {
      upsert:       vi.fn().mockResolvedValue(inflation),
      findByRegion: vi.fn().mockResolvedValue(inflation),
      deactivate:   vi.fn().mockResolvedValue(undefined),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as InflationRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new InflationControlService(inflationRepo, bus)
  })

  it('upsertInflation upserts inflation record', async () => {
    const result = await svc.upsertInflation({
      regionId: REGION_ID, inflationRate: 0.025, ownerServerId: 'server-1',
    })
    expect(result.regionId).toBe(REGION_ID)
    expect(inflationRepo.upsert).toHaveBeenCalledOnce()
  })

  it('getInflation returns record or null', async () => {
    const result = await svc.getInflation(REGION_ID)
    expect(result?.regionId).toBe(REGION_ID)
  })

  it('deactivateInflation calls deactivate', async () => {
    await svc.deactivateInflation(REGION_ID)
    expect(inflationRepo.deactivate).toHaveBeenCalledWith(REGION_ID)
  })
})

// ── AutonomousTaxAdjustmentService ───────────────────────────────────────────

describe('AutonomousTaxAdjustmentService', () => {
  let taxRepo: TaxRuntimeRepository
  let audit: EconomyAuditRepository
  let bus: EconomyRegulationEventBus
  let svc: AutonomousTaxAdjustmentService

  beforeEach(() => {
    const tax = {
      id: ULID, regionId: REGION_ID, taxType: 'income' as const,
      taxRate: '0.2000', status: 'active' as const, ownerServerId: 'server-1',
      createdAt: new Date(), updatedAt: new Date(), taxData: '{}',
    }
    taxRepo = {
      upsert:       vi.fn().mockResolvedValue(tax),
      findByRegion: vi.fn().mockResolvedValue(tax),
      suspend:      vi.fn().mockResolvedValue(undefined),
      cleanupExpired: vi.fn().mockResolvedValue(0),
    } as unknown as TaxRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new AutonomousTaxAdjustmentService(taxRepo, audit, bus)
  })

  it('upsertTaxRate upserts tax record', async () => {
    const result = await svc.upsertTaxRate({
      regionId: REGION_ID, taxType: 'income', taxRate: 0.2, ownerServerId: 'server-1',
    })
    expect(result.regionId).toBe(REGION_ID)
    expect(taxRepo.upsert).toHaveBeenCalledOnce()
  })

  it('getTaxRate returns tax or null', async () => {
    const result = await svc.getTaxRate(REGION_ID)
    expect(result?.regionId).toBe(REGION_ID)
  })

  it('suspendTax calls suspend on the repo', async () => {
    await svc.suspendTax(REGION_ID)
    expect(taxRepo.suspend).toHaveBeenCalledWith(REGION_ID)
  })
})

// ── MarketStabilizationService ───────────────────────────────────────────────

describe('MarketStabilizationService', () => {
  let stabilizationRepo: MarketStabilizationRepository
  let audit: EconomyAuditRepository
  let bus: EconomyRegulationEventBus
  let svc: MarketStabilizationService

  beforeEach(() => {
    const stabilization = {
      id: ULID, stabilizationId: STABILIZATION_ID, marketType: 'goods' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      stabilizationNonce: 'nonce-1', regionId: REGION_ID,
      completedAt: null, createdAt: new Date(), updatedAt: new Date(), stabilizationData: {},
    }
    stabilizationRepo = {
      create:       vi.fn().mockResolvedValue(stabilization),
      findById:     vi.fn().mockResolvedValue(stabilization),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...stabilization, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as MarketStabilizationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new MarketStabilizationService(stabilizationRepo, audit, bus)
  })

  it('startStabilization creates a pending stabilization', async () => {
    const result = await svc.startStabilization({
      marketType: 'goods', ownerServerId: 'server-1',
      stabilizationNonce: 'nonce-1', regionId: REGION_ID,
    })
    expect(result.stabilizationId).toBe(STABILIZATION_ID)
    expect(result.status).toBe('pending')
  })

  it('completeStabilization transitions to completed', async () => {
    const result = await svc.completeStabilization(ULID)
    expect(result.status).toBe('completed')
  })

  it('failStabilization transitions to failed', async () => {
    const result = await svc.failStabilization(ULID)
    expect(result.status).toBe('failed')
  })

  it('getStabilization returns stabilization or null', async () => {
    const result = await svc.getStabilization(ULID)
    expect(result?.stabilizationId).toBe(STABILIZATION_ID)
  })
})

// ── EconomicRecoveryService ──────────────────────────────────────────────────

describe('EconomicRecoveryService', () => {
  let regulationRepo: EconomyRegulationRepository
  let balancingRepo: ResourceBalancingRepository
  let stabilizationRepo: MarketStabilizationRepository
  let audit: EconomyAuditRepository
  let bus: EconomyRegulationEventBus
  let svc: EconomicRecoveryService

  beforeEach(() => {
    regulationRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      listActive: vi.fn(), cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as EconomyRegulationRepository
    balancingRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as ResourceBalancingRepository
    stabilizationRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as MarketStabilizationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new EconomicRecoveryService(regulationRepo, balancingRepo, stabilizationRepo, audit, bus)
  })

  it('cleanupStale returns counts for regulations, balancings, stabilizations', async () => {
    const result = await svc.cleanupStale(300000)
    expect(result.regulations).toBe(3)
    expect(result.balancings).toBe(2)
    expect(result.stabilizations).toBe(1)
  })
})
