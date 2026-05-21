import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  EcologyRuntimeService,
  EnvironmentalEvolutionService,
  ResourceRegenerationService,
  ClimatePersistenceService,
  WildlifeSimulationService,
  EcologyRecoveryService,
} from '@atc/ecology-runtime'
import type {
  EcologyRuntimeRepository,
  EnvironmentalEvolutionRepository,
  ResourceRegenerationRepository,
  ClimateRuntimeRepository,
  WildlifeRuntimeRepository,
  EcologyAuditRepository,
  EcologyRuntimeEventBus,
} from '@atc/ecology-runtime'

const ULID            = '01JABCDEFGHJKMNPQRST'
const ECOLOGY_ID      = 'ECO_001'
const EVOLUTION_ID    = 'EVO_001'
const REGENERATION_ID = 'REG_001'
const REGION_ID       = 'REGION_001'
const ZONE_ID         = 'ZONE_001'

function mockAudit(): EcologyAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as EcologyAuditRepository
}

function mockBus(): EcologyRuntimeEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── EcologyRuntimeService ────────────────────────────────────────────────────

describe('EcologyRuntimeService', () => {
  let ecologyRepo: EcologyRuntimeRepository
  let audit: EcologyAuditRepository
  let bus: EcologyRuntimeEventBus
  let svc: EcologyRuntimeService

  beforeEach(() => {
    const ecology = {
      id: ULID, ecologyId: ECOLOGY_ID, ecologyType: 'forest' as const,
      status: 'stable' as const, ownerServerId: 'server-1',
      regionId: REGION_ID, ecologyNonce: 'nonce-1',
      ecologyData: {}, createdAt: new Date(), updatedAt: new Date(),
    }
    ecologyRepo = {
      create:       vi.fn().mockResolvedValue(ecology),
      findById:     vi.fn().mockResolvedValue(ecology),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string) =>
        Promise.resolve({ ...ecology, status })
      ),
      listActive:   vi.fn().mockResolvedValue([ecology]),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as EcologyRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new EcologyRuntimeService(ecologyRepo, audit, bus)
  })

  it('createEcology creates a stable ecology', async () => {
    const result = await svc.createEcology({
      ecologyType: 'forest', ownerServerId: 'server-1',
      ecologyNonce: 'nonce-1',
    })
    expect(result.ecologyId).toBe(ECOLOGY_ID)
    expect(result.status).toBe('stable')
    expect(ecologyRepo.create).toHaveBeenCalledOnce()
  })

  it('degradeEcology transitions to degrading', async () => {
    const result = await svc.degradeEcology(ULID)
    expect(result.status).toBe('degrading')
  })

  it('getEcology returns ecology or null', async () => {
    const result = await svc.getEcology(ULID)
    expect(result?.ecologyId).toBe(ECOLOGY_ID)
  })

  it('listActiveEcologies returns array', async () => {
    const result = await svc.listActiveEcologies()
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
  })
})

// ── EnvironmentalEvolutionService ────────────────────────────────────────────

describe('EnvironmentalEvolutionService', () => {
  let evolutionRepo: EnvironmentalEvolutionRepository
  let audit: EcologyAuditRepository
  let bus: EcologyRuntimeEventBus
  let svc: EnvironmentalEvolutionService

  beforeEach(() => {
    const evolution = {
      id: ULID, evolutionId: EVOLUTION_ID, evolutionType: 'climate_shift' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      regionId: REGION_ID, evolutionNonce: 'nonce-1',
      evolutionData: {}, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    evolutionRepo = {
      create:       vi.fn().mockResolvedValue(evolution),
      findById:     vi.fn().mockResolvedValue(evolution),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...evolution, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as EnvironmentalEvolutionRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new EnvironmentalEvolutionService(evolutionRepo, audit, bus)
  })

  it('startEvolution creates a pending evolution', async () => {
    const result = await svc.startEvolution({
      evolutionType: 'climate_shift', ownerServerId: 'server-1',
      evolutionNonce: 'nonce-1',
    })
    expect(result.evolutionId).toBe(EVOLUTION_ID)
    expect(result.status).toBe('pending')
  })

  it('completeEvolution transitions to completed', async () => {
    const result = await svc.completeEvolution(ULID)
    expect(result.status).toBe('completed')
  })

  it('failEvolution transitions to failed', async () => {
    const result = await svc.failEvolution(ULID)
    expect(result.status).toBe('failed')
  })

  it('getEvolution returns evolution or null', async () => {
    const result = await svc.getEvolution(ULID)
    expect(result?.evolutionId).toBe(EVOLUTION_ID)
  })
})

// ── ResourceRegenerationService ──────────────────────────────────────────────

describe('ResourceRegenerationService', () => {
  let regenerationRepo: ResourceRegenerationRepository
  let audit: EcologyAuditRepository
  let bus: EcologyRuntimeEventBus
  let svc: ResourceRegenerationService

  beforeEach(() => {
    const regeneration = {
      id: ULID, regenerationId: REGENERATION_ID, resourceType: 'flora' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      regionId: REGION_ID, regenerationNonce: 'nonce-1',
      regenerationData: {}, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    regenerationRepo = {
      create:       vi.fn().mockResolvedValue(regeneration),
      findById:     vi.fn().mockResolvedValue(regeneration),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...regeneration, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as ResourceRegenerationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new ResourceRegenerationService(regenerationRepo, audit, bus)
  })

  it('startRegeneration creates a pending regeneration', async () => {
    const result = await svc.startRegeneration({
      resourceType: 'flora', ownerServerId: 'server-1',
      regenerationNonce: 'nonce-1',
    })
    expect(result.regenerationId).toBe(REGENERATION_ID)
    expect(result.status).toBe('pending')
  })

  it('completeRegeneration transitions to completed', async () => {
    const result = await svc.completeRegeneration(ULID)
    expect(result.status).toBe('completed')
  })

  it('failRegeneration transitions to failed', async () => {
    const result = await svc.failRegeneration(ULID)
    expect(result.status).toBe('failed')
  })

  it('getRegeneration returns regeneration or null', async () => {
    const result = await svc.getRegeneration(ULID)
    expect(result?.regenerationId).toBe(REGENERATION_ID)
  })
})

// ── ClimatePersistenceService ────────────────────────────────────────────────

describe('ClimatePersistenceService', () => {
  let climateRepo: ClimateRuntimeRepository
  let audit: EcologyAuditRepository
  let bus: EcologyRuntimeEventBus
  let svc: ClimatePersistenceService

  beforeEach(() => {
    const climate = {
      id: ULID, regionId: REGION_ID, climateType: 'temperate' as const,
      status: 'stable' as const, ownerServerId: 'server-1',
      temperature: 20.5, humidity: 65.0,
      climateData: {}, measuredAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    }
    climateRepo = {
      upsert:       vi.fn().mockResolvedValue(climate),
      findByRegion: vi.fn().mockResolvedValue(climate),
    } as unknown as ClimateRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new ClimatePersistenceService(climateRepo, audit, bus)
  })

  it('upsertClimate upserts climate record', async () => {
    const result = await svc.upsertClimate({
      regionId: REGION_ID, climateType: 'temperate',
      ownerServerId: 'server-1', temperature: 20.5, humidity: 65.0,
    })
    expect(result.regionId).toBe(REGION_ID)
    expect(climateRepo.upsert).toHaveBeenCalledOnce()
  })

  it('getClimate returns climate or null', async () => {
    const result = await svc.getClimate(REGION_ID)
    expect(result?.regionId).toBe(REGION_ID)
  })
})

// ── WildlifeSimulationService ────────────────────────────────────────────────

describe('WildlifeSimulationService', () => {
  let wildlifeRepo: WildlifeRuntimeRepository
  let audit: EcologyAuditRepository
  let bus: EcologyRuntimeEventBus
  let svc: WildlifeSimulationService

  beforeEach(() => {
    const wildlife = {
      id: ULID, zoneId: ZONE_ID, wildlifeType: 'predator' as const,
      status: 'stable' as const, ownerServerId: 'server-1',
      population: 42, wildlifeData: {},
      createdAt: new Date(), updatedAt: new Date(),
    }
    wildlifeRepo = {
      upsert:      vi.fn().mockResolvedValue(wildlife),
      findByZone:  vi.fn().mockResolvedValue(wildlife),
      cleanupExtinct: vi.fn().mockResolvedValue(0),
    } as unknown as WildlifeRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new WildlifeSimulationService(wildlifeRepo, audit, bus)
  })

  it('upsertWildlife upserts wildlife record', async () => {
    const result = await svc.upsertWildlife({
      zoneId: ZONE_ID, wildlifeType: 'predator',
      ownerServerId: 'server-1', population: 42,
    })
    expect(result.zoneId).toBe(ZONE_ID)
    expect(wildlifeRepo.upsert).toHaveBeenCalledOnce()
  })

  it('getWildlife returns wildlife or null', async () => {
    const result = await svc.getWildlife(ZONE_ID)
    expect(result?.zoneId).toBe(ZONE_ID)
  })
})

// ── EcologyRecoveryService ───────────────────────────────────────────────────

describe('EcologyRecoveryService', () => {
  let ecologyRepo: EcologyRuntimeRepository
  let evolutionRepo: EnvironmentalEvolutionRepository
  let regenerationRepo: ResourceRegenerationRepository
  let audit: EcologyAuditRepository
  let bus: EcologyRuntimeEventBus
  let svc: EcologyRecoveryService

  beforeEach(() => {
    ecologyRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      listActive: vi.fn(), cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as EcologyRuntimeRepository
    evolutionRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as EnvironmentalEvolutionRepository
    regenerationRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as ResourceRegenerationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new EcologyRecoveryService(ecologyRepo, evolutionRepo, regenerationRepo, audit, bus)
  })

  it('cleanupStale returns counts for ecologies, evolutions, regenerations', async () => {
    const result = await svc.cleanupStale(300000)
    expect(result.ecologies).toBe(3)
    expect(result.evolutions).toBe(2)
    expect(result.regenerations).toBe(1)
  })
})
