import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  EnterpriseReadinessRepository, AtcEnterpriseReadiness,
  DeterministicAuditRepository, AtcDeterministicAudit,
  IntegrityVerificationRepository, AtcIntegrityVerification,
  ProductionReadinessRepository, AtcProductionReadiness,
  DistributedAuditRepository, AtcDistributedAudit,
  EnterpriseAuditRepository, EnterpriseReadinessEventBus,
} from '@atc/enterprise-readiness-runtime'
import {
  EnterpriseReadinessService,
  DeterministicAuditService,
  RuntimeIntegrityVerificationService,
  ProductionReadinessCoordinator,
  DistributedAuditOrchestrator,
  EnterpriseRecoveryService,
} from '@atc/enterprise-readiness-runtime'

function mockBus(): EnterpriseReadinessEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

function mockAudit(): EnterpriseAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as EnterpriseAuditRepository
}

describe('EnterpriseReadinessService', () => {
  let readinessRepo: EnterpriseReadinessRepository
  let audit: EnterpriseAuditRepository
  let bus: EnterpriseReadinessEventBus
  let service: EnterpriseReadinessService

  beforeEach(() => {
    const readiness: AtcEnterpriseReadiness = {
      id: '01ER', readinessId: '01ES', readinessType: 'technical',
      status: 'pending', ownerServerId: 'srv-1', readinessNonce: 'nonce-er-1',
      readinessData: {}, confirmedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    readinessRepo = {
      create: vi.fn().mockResolvedValue(readiness),
      findById: vi.fn().mockResolvedValue(readiness),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, confirmedAt?: Date) =>
        Promise.resolve({ ...readiness, status, confirmedAt: confirmedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as EnterpriseReadinessRepository
    audit = mockAudit()
    bus = mockBus()
    service = new EnterpriseReadinessService(readinessRepo, audit, bus)
  })

  it('initiates a readiness record', async () => {
    const result = await service.initiateReadiness({ readinessType: 'technical', ownerServerId: 'srv-1', readinessNonce: 'nonce-er-1' })
    expect(result.status).toBe('pending')
    expect(result.readinessType).toBe('technical')
  })

  it('confirms readiness and sets confirmedAt', async () => {
    const result = await service.confirmReadiness('01ER')
    expect(result.status).toBe('ready')
    expect(result.confirmedAt).toBeInstanceOf(Date)
  })

  it('rejects readiness', async () => {
    const result = await service.rejectReadiness('01ER')
    expect(result.status).toBe('not_ready')
  })

  it('retrieves a readiness record by id', async () => {
    const result = await service.getReadiness('01ER')
    expect(result?.readinessType).toBe('technical')
  })
})

describe('DeterministicAuditService', () => {
  let auditRepo: DeterministicAuditRepository
  let audit: EnterpriseAuditRepository
  let bus: EnterpriseReadinessEventBus
  let service: DeterministicAuditService

  beforeEach(() => {
    const deterministicAudit: AtcDeterministicAudit = {
      id: '01DA', auditId: '01DB', auditType: 'state',
      status: 'pending', ownerServerId: 'srv-1', auditNonce: 'nonce-da-1',
      auditData: {}, completedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    auditRepo = {
      create: vi.fn().mockResolvedValue(deterministicAudit),
      findById: vi.fn().mockResolvedValue(deterministicAudit),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...deterministicAudit, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as DeterministicAuditRepository
    audit = mockAudit()
    bus = mockBus()
    service = new DeterministicAuditService(auditRepo, audit, bus)
  })

  it('creates a deterministic audit', async () => {
    const result = await service.createAudit({ auditType: 'state', ownerServerId: 'srv-1', auditNonce: 'nonce-da-1' })
    expect(result.auditType).toBe('state')
  })

  it('completes an audit and sets completedAt', async () => {
    const result = await service.completeAudit('01DA')
    expect(result.status).toBe('completed')
    expect(result.completedAt).toBeInstanceOf(Date)
  })
})

describe('RuntimeIntegrityVerificationService', () => {
  let verificationRepo: IntegrityVerificationRepository
  let audit: EnterpriseAuditRepository
  let bus: EnterpriseReadinessEventBus
  let service: RuntimeIntegrityVerificationService

  beforeEach(() => {
    const verification: AtcIntegrityVerification = {
      id: '01IV', verificationId: '01IW', verificationType: 'hash',
      status: 'pending', ownerServerId: 'srv-1', verificationNonce: 'nonce-iv-1',
      verificationData: {}, verifiedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    verificationRepo = {
      create: vi.fn().mockResolvedValue(verification),
      findById: vi.fn().mockResolvedValue(verification),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, verifiedAt?: Date) =>
        Promise.resolve({ ...verification, status, verifiedAt: verifiedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(5),
    } as unknown as IntegrityVerificationRepository
    audit = mockAudit()
    bus = mockBus()
    service = new RuntimeIntegrityVerificationService(verificationRepo, audit, bus)
  })

  it('creates an integrity verification', async () => {
    const result = await service.createVerification({ verificationType: 'hash', ownerServerId: 'srv-1', verificationNonce: 'nonce-iv-1' })
    expect(result.verificationType).toBe('hash')
  })

  it('verifies integrity and sets verifiedAt', async () => {
    const result = await service.verifyIntegrity('01IV')
    expect(result.status).toBe('verified')
    expect(result.verifiedAt).toBeInstanceOf(Date)
  })
})

describe('ProductionReadinessCoordinator', () => {
  let readinessRepo: ProductionReadinessRepository
  let audit: EnterpriseAuditRepository
  let bus: EnterpriseReadinessEventBus
  let service: ProductionReadinessCoordinator

  beforeEach(() => {
    const checkpoint: AtcProductionReadiness = {
      id: '01PR', readinessCheckpointId: 'checkpoint-1', checkpointType: 'pre_launch',
      status: 'active', ownerServerId: 'srv-1',
      checkpointData: {}, syncedAt: new Date(), confirmedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    readinessRepo = {
      upsert: vi.fn().mockResolvedValue(checkpoint),
      findByCheckpointId: vi.fn().mockResolvedValue(checkpoint),
      updateStatus: vi.fn().mockImplementation((_readinessCheckpointId: string, status: string, confirmedAt?: Date) =>
        Promise.resolve({ ...checkpoint, status, confirmedAt: confirmedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as ProductionReadinessRepository
    audit = mockAudit()
    bus = mockBus()
    service = new ProductionReadinessCoordinator(readinessRepo, audit, bus)
  })

  it('initiates a readiness checkpoint via upsert', async () => {
    const result = await service.initiateCheckpoint({ readinessCheckpointId: 'checkpoint-1', checkpointType: 'pre_launch', ownerServerId: 'srv-1' })
    expect(result.readinessCheckpointId).toBe('checkpoint-1')
    expect(result.checkpointType).toBe('pre_launch')
  })

  it('confirms a checkpoint and sets confirmedAt', async () => {
    const result = await service.confirmCheckpoint('checkpoint-1')
    expect(result.status).toBe('confirmed')
    expect(result.confirmedAt).toBeInstanceOf(Date)
  })
})

describe('DistributedAuditOrchestrator', () => {
  let distributedAuditRepo: DistributedAuditRepository
  let audit: EnterpriseAuditRepository
  let bus: EnterpriseReadinessEventBus
  let service: DistributedAuditOrchestrator

  beforeEach(() => {
    const node: AtcDistributedAudit = {
      id: '01AN', auditNodeId: 'node-1', nodeType: 'primary',
      status: 'active', ownerServerId: 'srv-1',
      nodeData: {}, syncedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    }
    distributedAuditRepo = {
      upsert: vi.fn().mockResolvedValue(node),
      findByNodeId: vi.fn().mockResolvedValue(node),
      updateStatus: vi.fn().mockImplementation((_auditNodeId: string, status: string) =>
        Promise.resolve({ ...node, status })
      ),
      cleanupStale: vi.fn().mockResolvedValue(6),
    } as unknown as DistributedAuditRepository
    audit = mockAudit()
    bus = mockBus()
    service = new DistributedAuditOrchestrator(distributedAuditRepo, audit, bus)
  })

  it('registers an audit node via upsert', async () => {
    const result = await service.registerNode({ auditNodeId: 'node-1', nodeType: 'primary', ownerServerId: 'srv-1' })
    expect(result.auditNodeId).toBe('node-1')
    expect(result.nodeType).toBe('primary')
  })

  it('degrades an audit node', async () => {
    const result = await service.degradeNode('node-1')
    expect(result.status).toBe('degraded')
  })
})

describe('EnterpriseRecoveryService', () => {
  it('cleans up stale records and returns counts', async () => {
    const readinessRepo = { cleanupStale: vi.fn().mockResolvedValue(3) } as unknown as EnterpriseReadinessRepository
    const deterministicAuditRepo = { cleanupStale: vi.fn().mockResolvedValue(4) } as unknown as DeterministicAuditRepository
    const integrityRepo = { cleanupStale: vi.fn().mockResolvedValue(5) } as unknown as IntegrityVerificationRepository
    const productionReadinessRepo = { cleanupStale: vi.fn().mockResolvedValue(2) } as unknown as ProductionReadinessRepository
    const distributedAuditRepo = { cleanupStale: vi.fn().mockResolvedValue(6) } as unknown as DistributedAuditRepository
    const audit = mockAudit()
    const bus = mockBus()

    const service = new EnterpriseRecoveryService(readinessRepo, deterministicAuditRepo, integrityRepo, productionReadinessRepo, distributedAuditRepo, audit, bus)
    const result = await service.cleanupStale(300000)
    expect(result).toEqual({ readinesses: 3, deterministicAudits: 4, integrityVerifications: 5, productionReadinesses: 2, distributedAudits: 6 })
  })
})
