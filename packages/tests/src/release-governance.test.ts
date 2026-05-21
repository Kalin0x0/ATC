import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  ReleaseGovernanceRepository, AtcReleaseGovernance,
  ProductionDeploymentRepository, AtcProductionDeployment,
  ReleaseValidationRepository, AtcReleaseValidation,
  ReleaseOrchestrationRepository, AtcReleaseOrchestration,
  GlobalReleaseRuntimeRepository, AtcGlobalReleaseRuntime,
  ReleaseAuditRepository, ReleaseGovernanceEventBus,
} from '@atc/release-governance-runtime'
import {
  ReleaseGovernanceService,
  ProductionDeploymentCoordinator,
  RuntimeReleaseValidationService,
  DistributedReleaseOrchestrator,
  GlobalDeploymentGovernanceService,
  ReleaseRecoveryService,
} from '@atc/release-governance-runtime'

function mockBus(): ReleaseGovernanceEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

function mockAudit(): ReleaseAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as ReleaseAuditRepository
}

describe('ReleaseGovernanceService', () => {
  let governanceRepo: ReleaseGovernanceRepository
  let audit: ReleaseAuditRepository
  let bus: ReleaseGovernanceEventBus
  let service: ReleaseGovernanceService

  beforeEach(() => {
    const governance: AtcReleaseGovernance = {
      id: '01G', governanceId: '01H', governanceType: 'policy',
      status: 'pending', ownerServerId: 'srv-1', governanceNonce: 'nonce-g-1',
      governanceData: {}, startedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    governanceRepo = {
      create: vi.fn().mockResolvedValue(governance),
      findById: vi.fn().mockResolvedValue(governance),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, startedAt?: Date) =>
        Promise.resolve({ ...governance, status, startedAt: startedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as ReleaseGovernanceRepository
    audit = mockAudit()
    bus = mockBus()
    service = new ReleaseGovernanceService(governanceRepo, audit, bus)
  })

  it('initiates a governance record', async () => {
    const result = await service.initiateGovernance({ governanceType: 'policy', ownerServerId: 'srv-1', governanceNonce: 'nonce-g-1' })
    expect(result.status).toBe('pending')
    expect(result.governanceType).toBe('policy')
  })

  it('starts governance and sets startedAt', async () => {
    const result = await service.startGovernance('01G')
    expect(result.status).toBe('active')
    expect(result.startedAt).toBeInstanceOf(Date)
  })

  it('approves governance', async () => {
    const result = await service.approveGovernance('01G')
    expect(result.status).toBe('approved')
  })

  it('rejects governance', async () => {
    const result = await service.rejectGovernance('01G')
    expect(result.status).toBe('rejected')
  })

  it('retrieves a governance record by id', async () => {
    const result = await service.getGovernance('01G')
    expect(result?.governanceType).toBe('policy')
  })
})

describe('ProductionDeploymentCoordinator', () => {
  let deploymentRepo: ProductionDeploymentRepository
  let audit: ReleaseAuditRepository
  let bus: ReleaseGovernanceEventBus
  let service: ProductionDeploymentCoordinator

  beforeEach(() => {
    const deployment: AtcProductionDeployment = {
      id: '01D', deploymentId: 'deploy-1', deploymentType: 'canary',
      status: 'active', ownerServerId: 'srv-1',
      deploymentData: {}, syncedAt: new Date(), completedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    deploymentRepo = {
      upsert: vi.fn().mockResolvedValue(deployment),
      findByDeploymentId: vi.fn().mockResolvedValue(deployment),
      updateStatus: vi.fn().mockImplementation((_deploymentId: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...deployment, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as ProductionDeploymentRepository
    audit = mockAudit()
    bus = mockBus()
    service = new ProductionDeploymentCoordinator(deploymentRepo, audit, bus)
  })

  it('initiates a deployment via upsert', async () => {
    const result = await service.initiateDeployment({ deploymentId: 'deploy-1', deploymentType: 'canary', ownerServerId: 'srv-1' })
    expect(result.deploymentId).toBe('deploy-1')
    expect(result.deploymentType).toBe('canary')
  })

  it('completes a deployment and sets completedAt', async () => {
    const result = await service.completeDeployment('deploy-1')
    expect(result.status).toBe('deployed')
    expect(result.completedAt).toBeInstanceOf(Date)
  })
})

describe('RuntimeReleaseValidationService', () => {
  let validationRepo: ReleaseValidationRepository
  let audit: ReleaseAuditRepository
  let bus: ReleaseGovernanceEventBus
  let service: RuntimeReleaseValidationService

  beforeEach(() => {
    const validation: AtcReleaseValidation = {
      id: '01V', validationId: '01W', validationType: 'smoke',
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
    } as unknown as ReleaseValidationRepository
    audit = mockAudit()
    bus = mockBus()
    service = new RuntimeReleaseValidationService(validationRepo, audit, bus)
  })

  it('creates a release validation', async () => {
    const result = await service.createValidation({ validationType: 'smoke', ownerServerId: 'srv-1', validationNonce: 'nonce-v-1' })
    expect(result.validationType).toBe('smoke')
  })

  it('passes validation and sets validatedAt', async () => {
    const result = await service.passValidation('01V')
    expect(result.status).toBe('passed')
    expect(result.validatedAt).toBeInstanceOf(Date)
  })
})

describe('DistributedReleaseOrchestrator', () => {
  let orchestrationRepo: ReleaseOrchestrationRepository
  let audit: ReleaseAuditRepository
  let bus: ReleaseGovernanceEventBus
  let service: DistributedReleaseOrchestrator

  beforeEach(() => {
    const orchestration: AtcReleaseOrchestration = {
      id: '01O', orchestrationId: 'orch-1', orchestrationType: 'sequential',
      status: 'active', ownerServerId: 'srv-1',
      orchestrationData: {}, syncedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    }
    orchestrationRepo = {
      upsert: vi.fn().mockResolvedValue(orchestration),
      findByOrchestrationId: vi.fn().mockResolvedValue(orchestration),
      updateStatus: vi.fn().mockImplementation((_orchestrationId: string, status: string) =>
        Promise.resolve({ ...orchestration, status })
      ),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as ReleaseOrchestrationRepository
    audit = mockAudit()
    bus = mockBus()
    service = new DistributedReleaseOrchestrator(orchestrationRepo, audit, bus)
  })

  it('initiates an orchestration via upsert', async () => {
    const result = await service.initiateOrchestration({ orchestrationId: 'orch-1', orchestrationType: 'sequential', ownerServerId: 'srv-1' })
    expect(result.orchestrationId).toBe('orch-1')
    expect(result.orchestrationType).toBe('sequential')
  })

  it('completes an orchestration', async () => {
    const result = await service.completeOrchestration('orch-1')
    expect(result.status).toBe('completed')
  })
})

describe('GlobalDeploymentGovernanceService', () => {
  let releaseRepo: GlobalReleaseRuntimeRepository
  let audit: ReleaseAuditRepository
  let bus: ReleaseGovernanceEventBus
  let service: GlobalDeploymentGovernanceService

  beforeEach(() => {
    const release: AtcGlobalReleaseRuntime = {
      id: '01R', releaseId: '01RX', releaseType: 'major',
      status: 'pending', ownerServerId: 'srv-1', releaseNonce: 'nonce-r-1',
      releaseData: {}, completedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    releaseRepo = {
      create: vi.fn().mockResolvedValue(release),
      findById: vi.fn().mockResolvedValue(release),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...release, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(5),
    } as unknown as GlobalReleaseRuntimeRepository
    audit = mockAudit()
    bus = mockBus()
    service = new GlobalDeploymentGovernanceService(releaseRepo, audit, bus)
  })

  it('creates a global release', async () => {
    const result = await service.createRelease({ releaseType: 'major', ownerServerId: 'srv-1', releaseNonce: 'nonce-r-1' })
    expect(result.releaseType).toBe('major')
  })

  it('completes a release and sets completedAt', async () => {
    const result = await service.completeRelease('01R')
    expect(result.status).toBe('completed')
    expect(result.completedAt).toBeInstanceOf(Date)
  })
})

describe('ReleaseRecoveryService', () => {
  it('cleans up stale records and returns counts', async () => {
    const governanceRepo = { cleanupStale: vi.fn().mockResolvedValue(3) } as unknown as ReleaseGovernanceRepository
    const deploymentRepo = { cleanupStale: vi.fn().mockResolvedValue(2) } as unknown as ProductionDeploymentRepository
    const validationRepo = { cleanupStale: vi.fn().mockResolvedValue(4) } as unknown as ReleaseValidationRepository
    const orchestrationRepo = { cleanupStale: vi.fn().mockResolvedValue(1) } as unknown as ReleaseOrchestrationRepository
    const globalReleaseRepo = { cleanupStale: vi.fn().mockResolvedValue(5) } as unknown as GlobalReleaseRuntimeRepository
    const audit = mockAudit()
    const bus = mockBus()

    const service = new ReleaseRecoveryService(governanceRepo, deploymentRepo, validationRepo, orchestrationRepo, globalReleaseRepo, audit, bus)
    const result = await service.cleanupStale(300000)
    expect(result).toEqual({ governances: 3, deployments: 2, validations: 4, orchestrations: 1, globalReleases: 5 })
  })
})
