import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  CoreClosureRepository, AtcCoreClosure,
  RuntimeImmutabilityRepository, AtcRuntimeImmutability,
  ProductionFreezeRepository, AtcProductionFreeze,
  DistributedClosureRepository, AtcDistributedClosure,
  FinalValidationRepository, AtcFinalValidation,
  CoreClosureAuditRepository, CoreClosureEventBus,
} from '@atc/core-closure-runtime'
import {
  CoreClosureService,
  ProductionImmutabilityService,
  RuntimeFreezeCoordinator,
  DistributedClosureOrchestrator,
  DeterministicCompletionValidator,
  FinalRecoveryCoordinator,
} from '@atc/core-closure-runtime'

function mockBus(): CoreClosureEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

function mockAudit(): CoreClosureAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as CoreClosureAuditRepository
}

describe('CoreClosureService', () => {
  let closureRepo: CoreClosureRepository
  let audit: CoreClosureAuditRepository
  let bus: CoreClosureEventBus
  let service: CoreClosureService

  beforeEach(() => {
    const closure: AtcCoreClosure = {
      id: '01C', closureId: '01D', closureType: 'final',
      status: 'pending', ownerServerId: 'srv-1', closureNonce: 'nonce-c-1',
      closureData: {}, sealedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    closureRepo = {
      create: vi.fn().mockResolvedValue(closure),
      findById: vi.fn().mockResolvedValue(closure),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, sealedAt?: Date) =>
        Promise.resolve({ ...closure, status, sealedAt: sealedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as CoreClosureRepository
    audit = mockAudit()
    bus = mockBus()
    service = new CoreClosureService(closureRepo, audit, bus)
  })

  it('initiates a closure record', async () => {
    const result = await service.initiateClosure({ closureType: 'final', ownerServerId: 'srv-1', closureNonce: 'nonce-c-1' })
    expect(result.status).toBe('pending')
    expect(result.closureType).toBe('final')
  })

  it('starts closure and emits core_closure_started', async () => {
    const result = await service.startClosure('01C')
    expect(result.status).toBe('active')
  })

  it('seals closure and emits immutable_production_seal_applied', async () => {
    const result = await service.sealClosure('01C')
    expect(result.status).toBe('sealed')
    expect(result.sealedAt).toBeInstanceOf(Date)
  })

  it('fails a closure', async () => {
    const result = await service.failClosure('01C')
    expect(result.status).toBe('failed')
  })

  it('retrieves a closure by id', async () => {
    const result = await service.getClosure('01C')
    expect(result?.closureType).toBe('final')
  })
})

describe('ProductionImmutabilityService', () => {
  let immutabilityRepo: RuntimeImmutabilityRepository
  let audit: CoreClosureAuditRepository
  let bus: CoreClosureEventBus
  let service: ProductionImmutabilityService

  beforeEach(() => {
    const immutability: AtcRuntimeImmutability = {
      id: '01I', immutabilityId: '01J', immutabilityType: 'full',
      status: 'pending', ownerServerId: 'srv-1', immutabilityNonce: 'nonce-i-1',
      immutabilityData: {}, frozenAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    immutabilityRepo = {
      create: vi.fn().mockResolvedValue(immutability),
      findById: vi.fn().mockResolvedValue(immutability),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, frozenAt?: Date) =>
        Promise.resolve({ ...immutability, status, frozenAt: frozenAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as RuntimeImmutabilityRepository
    audit = mockAudit()
    bus = mockBus()
    service = new ProductionImmutabilityService(immutabilityRepo, audit, bus)
  })

  it('creates a runtime immutability record', async () => {
    const result = await service.createImmutability({ immutabilityType: 'full', ownerServerId: 'srv-1', immutabilityNonce: 'nonce-i-1' })
    expect(result.immutabilityType).toBe('full')
  })

  it('freezes immutability and emits runtime_frozen', async () => {
    const result = await service.freezeImmutability('01I')
    expect(result.status).toBe('frozen')
    expect(result.frozenAt).toBeInstanceOf(Date)
  })
})

describe('RuntimeFreezeCoordinator', () => {
  let freezeRepo: ProductionFreezeRepository
  let audit: CoreClosureAuditRepository
  let bus: CoreClosureEventBus
  let service: RuntimeFreezeCoordinator

  beforeEach(() => {
    const freeze: AtcProductionFreeze = {
      id: '01F', freezeId: 'freeze-1', freezeType: 'hard',
      status: 'active', ownerServerId: 'srv-1',
      freezeData: {}, syncedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    }
    freezeRepo = {
      upsert: vi.fn().mockResolvedValue(freeze),
      findByFreezeId: vi.fn().mockResolvedValue(freeze),
      updateStatus: vi.fn().mockImplementation((_freezeId: string, status: string) =>
        Promise.resolve({ ...freeze, status })
      ),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as ProductionFreezeRepository
    audit = mockAudit()
    bus = mockBus()
    service = new RuntimeFreezeCoordinator(freezeRepo, audit, bus)
  })

  it('initiates a production freeze via upsert', async () => {
    const result = await service.initiateFreeze({ freezeId: 'freeze-1', freezeType: 'hard', ownerServerId: 'srv-1' })
    expect(result.freezeId).toBe('freeze-1')
    expect(result.freezeType).toBe('hard')
  })

  it('degrades a freeze', async () => {
    const result = await service.degradeFreeze('freeze-1')
    expect(result.status).toBe('degraded')
  })
})

describe('DistributedClosureOrchestrator', () => {
  let nodeRepo: DistributedClosureRepository
  let audit: CoreClosureAuditRepository
  let bus: CoreClosureEventBus
  let service: DistributedClosureOrchestrator

  beforeEach(() => {
    const node: AtcDistributedClosure = {
      id: '01N', closureNodeId: 'node-1', nodeType: 'primary',
      status: 'active', ownerServerId: 'srv-1',
      closureNodeData: {}, syncedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    }
    nodeRepo = {
      upsert: vi.fn().mockResolvedValue(node),
      findByNodeId: vi.fn().mockResolvedValue(node),
      updateStatus: vi.fn().mockImplementation((_nodeId: string, status: string) =>
        Promise.resolve({ ...node, status })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as DistributedClosureRepository
    audit = mockAudit()
    bus = mockBus()
    service = new DistributedClosureOrchestrator(nodeRepo, audit, bus)
  })

  it('registers a closure node via upsert', async () => {
    const result = await service.registerNode({ closureNodeId: 'node-1', nodeType: 'primary', ownerServerId: 'srv-1' })
    expect(result.closureNodeId).toBe('node-1')
    expect(result.nodeType).toBe('primary')
  })

  it('completes sync and emits distributed_closure_completed', async () => {
    const result = await service.completeSyncNode('node-1')
    expect(result.status).toBe('synced')
  })
})

describe('DeterministicCompletionValidator', () => {
  let validationRepo: FinalValidationRepository
  let audit: CoreClosureAuditRepository
  let bus: CoreClosureEventBus
  let service: DeterministicCompletionValidator

  beforeEach(() => {
    const validation: AtcFinalValidation = {
      id: '01V', validationId: '01W', validationType: 'deterministic',
      status: 'pending', ownerServerId: 'srv-1', validationNonce: 'nonce-v-1',
      validationData: {}, validatedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    validationRepo = {
      create: vi.fn().mockResolvedValue(validation),
      findById: vi.fn().mockResolvedValue(validation),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, validatedAt?: Date) =>
        Promise.resolve({ ...validation, status, validatedAt: validatedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as FinalValidationRepository
    audit = mockAudit()
    bus = mockBus()
    service = new DeterministicCompletionValidator(validationRepo, audit, bus)
  })

  it('creates a final validation record', async () => {
    const result = await service.createValidation({ validationType: 'deterministic', ownerServerId: 'srv-1', validationNonce: 'nonce-v-1' })
    expect(result.validationType).toBe('deterministic')
  })

  it('completes validation and emits atc_core_completed', async () => {
    const result = await service.completeValidation('01V')
    expect(result.status).toBe('completed')
    expect(result.validatedAt).toBeInstanceOf(Date)
    const emitMock = bus.emit as ReturnType<typeof vi.fn>
    const emittedEvents = emitMock.mock.calls.map((c: unknown[]) => c[0])
    expect(emittedEvents).toContain('deterministic_validation_completed')
    expect(emittedEvents).toContain('final_runtime_reconciliation_completed')
    expect(emittedEvents).toContain('atc_core_completed')
  })
})

describe('FinalRecoveryCoordinator', () => {
  it('cleans up stale records and returns counts', async () => {
    const closureRepo = { cleanupStale: vi.fn().mockResolvedValue(3) } as unknown as CoreClosureRepository
    const immutabilityRepo = { cleanupStale: vi.fn().mockResolvedValue(2) } as unknown as RuntimeImmutabilityRepository
    const freezeRepo = { cleanupStale: vi.fn().mockResolvedValue(1) } as unknown as ProductionFreezeRepository
    const nodeRepo = { cleanupStale: vi.fn().mockResolvedValue(2) } as unknown as DistributedClosureRepository
    const validationRepo = { cleanupStale: vi.fn().mockResolvedValue(4) } as unknown as FinalValidationRepository
    const audit = mockAudit()
    const bus = mockBus()

    const service = new FinalRecoveryCoordinator(closureRepo, immutabilityRepo, freezeRepo, nodeRepo, validationRepo, audit, bus)
    const result = await service.cleanupStale(300000)
    expect(result).toEqual({ closures: 3, immutabilities: 2, freezes: 1, closureNodes: 2, validations: 4 })
  })
})
