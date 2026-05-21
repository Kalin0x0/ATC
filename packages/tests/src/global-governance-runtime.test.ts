import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  GlobalGovernanceService,
  CrossSystemArbitrationService,
  RuntimeConsensusService,
  DistributedPolicyCoordinator,
  GlobalOwnershipAuthority,
  GovernanceContinuityService,
} from '@atc/global-governance-runtime'
import type {
  GlobalGovernanceRepository,
  CrossSystemArbitrationRepository,
  RuntimeConsensusRepository,
  GlobalPolicyRepository,
  GlobalOwnershipRepository,
  GovernanceContinuityAuditRepository,
  GlobalGovernanceEventBus,
} from '@atc/global-governance-runtime'

const ULID          = '01JABCDEFGHJKMNPQRST'
const DIRECTIVE_ID  = 'DIR_001'
const ARBITRATION_ID = 'ARB_001'
const CONSENSUS_ID  = 'CON_001'
const POLICY_ID     = 'POL_001'
const RESOURCE_ID   = 'RES_001'

function mockAudit(): GovernanceContinuityAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as GovernanceContinuityAuditRepository
}

function mockBus(): GlobalGovernanceEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── GlobalGovernanceService ──────────────────────────────────────────────────

describe('GlobalGovernanceService', () => {
  let directiveRepo: GlobalGovernanceRepository
  let audit: GovernanceContinuityAuditRepository
  let bus: GlobalGovernanceEventBus
  let svc: GlobalGovernanceService

  beforeEach(() => {
    const directive = {
      id: ULID, directiveId: DIRECTIVE_ID, directiveType: 'mandate' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      directiveNonce: 'nonce-1', directiveData: {}, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    directiveRepo = {
      create:       vi.fn().mockResolvedValue(directive),
      findById:     vi.fn().mockResolvedValue(directive),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...directive, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as GlobalGovernanceRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new GlobalGovernanceService(directiveRepo, audit, bus)
  })

  it('createDirective creates a pending directive', async () => {
    const result = await svc.createDirective({
      directiveType: 'mandate', ownerServerId: 'server-1', directiveNonce: 'nonce-1',
    })
    expect(result.directiveId).toBe(DIRECTIVE_ID)
    expect(result.status).toBe('pending')
    expect(directiveRepo.create).toHaveBeenCalledOnce()
  })

  it('activateDirective transitions to active', async () => {
    const result = await svc.activateDirective(ULID)
    expect(result.status).toBe('active')
  })

  it('resolveDirective transitions to resolved', async () => {
    const result = await svc.resolveDirective(ULID)
    expect(result.status).toBe('resolved')
  })

  it('failDirective transitions to failed', async () => {
    const result = await svc.failDirective(ULID)
    expect(result.status).toBe('failed')
  })

  it('getDirective returns record or null', async () => {
    const result = await svc.getDirective(ULID)
    expect(result?.directiveId).toBe(DIRECTIVE_ID)
  })
})

// ── CrossSystemArbitrationService ────────────────────────────────────────────

describe('CrossSystemArbitrationService', () => {
  let arbitrationRepo: CrossSystemArbitrationRepository
  let audit: GovernanceContinuityAuditRepository
  let bus: GlobalGovernanceEventBus
  let svc: CrossSystemArbitrationService

  beforeEach(() => {
    const arbitration = {
      id: ULID, arbitrationId: ARBITRATION_ID, arbitrationType: 'conflict' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      arbitrationNonce: 'nonce-1', arbitrationData: {}, resolvedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    arbitrationRepo = {
      create:       vi.fn().mockResolvedValue(arbitration),
      findById:     vi.fn().mockResolvedValue(arbitration),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, resolvedAt?: Date) =>
        Promise.resolve({ ...arbitration, status, resolvedAt: resolvedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as CrossSystemArbitrationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new CrossSystemArbitrationService(arbitrationRepo, audit, bus)
  })

  it('startArbitration creates a pending arbitration', async () => {
    const result = await svc.startArbitration({
      arbitrationType: 'conflict', ownerServerId: 'server-1', arbitrationNonce: 'nonce-1',
    })
    expect(result.arbitrationId).toBe(ARBITRATION_ID)
    expect(result.status).toBe('pending')
  })

  it('beginArbitrating transitions to arbitrating', async () => {
    const result = await svc.beginArbitrating(ULID)
    expect(result.status).toBe('arbitrating')
  })

  it('resolveArbitration transitions to resolved', async () => {
    const result = await svc.resolveArbitration(ULID)
    expect(result.status).toBe('resolved')
  })

  it('rejectArbitration transitions to rejected', async () => {
    const result = await svc.rejectArbitration(ULID)
    expect(result.status).toBe('rejected')
  })

  it('getArbitration returns record or null', async () => {
    const result = await svc.getArbitration(ULID)
    expect(result?.arbitrationId).toBe(ARBITRATION_ID)
  })
})

// ── RuntimeConsensusService ──────────────────────────────────────────────────

describe('RuntimeConsensusService', () => {
  let consensusRepo: RuntimeConsensusRepository
  let audit: GovernanceContinuityAuditRepository
  let bus: GlobalGovernanceEventBus
  let svc: RuntimeConsensusService

  beforeEach(() => {
    const consensus = {
      id: ULID, consensusId: CONSENSUS_ID, consensusType: 'raft' as const,
      status: 'proposed' as const, ownerServerId: 'server-1',
      consensusNonce: 'nonce-1', consensusData: {}, committedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    consensusRepo = {
      create:       vi.fn().mockResolvedValue(consensus),
      findById:     vi.fn().mockResolvedValue(consensus),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, committedAt?: Date) =>
        Promise.resolve({ ...consensus, status, committedAt: committedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as RuntimeConsensusRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeConsensusService(consensusRepo, audit, bus)
  })

  it('proposeConsensus creates a proposed consensus', async () => {
    const result = await svc.proposeConsensus({
      consensusType: 'raft', ownerServerId: 'server-1', consensusNonce: 'nonce-1',
    })
    expect(result.consensusId).toBe(CONSENSUS_ID)
    expect(result.status).toBe('proposed')
  })

  it('beginVoting transitions to voting', async () => {
    const result = await svc.beginVoting(ULID)
    expect(result.status).toBe('voting')
  })

  it('commitConsensus transitions to committed', async () => {
    const result = await svc.commitConsensus(ULID)
    expect(result.status).toBe('committed')
  })

  it('abortConsensus transitions to aborted', async () => {
    const result = await svc.abortConsensus(ULID)
    expect(result.status).toBe('aborted')
  })

  it('getConsensus returns record or null', async () => {
    const result = await svc.getConsensus(ULID)
    expect(result?.consensusId).toBe(CONSENSUS_ID)
  })
})

// ── DistributedPolicyCoordinator ─────────────────────────────────────────────

describe('DistributedPolicyCoordinator', () => {
  let policyRepo: GlobalPolicyRepository
  let audit: GovernanceContinuityAuditRepository
  let bus: GlobalGovernanceEventBus
  let svc: DistributedPolicyCoordinator

  beforeEach(() => {
    const policy = {
      id: ULID, policyId: POLICY_ID, policyType: 'resource' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      policyData: {}, expiresAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    policyRepo = {
      upsert:         vi.fn().mockResolvedValue(policy),
      findByPolicyId: vi.fn().mockResolvedValue(policy),
      updateStatus:   vi.fn().mockImplementation((_id: string, status: string) =>
        Promise.resolve({ ...policy, status })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as GlobalPolicyRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new DistributedPolicyCoordinator(policyRepo, audit, bus)
  })

  it('upsertPolicy upserts policy record', async () => {
    const result = await svc.upsertPolicy({
      policyId: POLICY_ID, policyType: 'resource', ownerServerId: 'server-1',
    })
    expect(result.policyId).toBe(POLICY_ID)
    expect(policyRepo.upsert).toHaveBeenCalledOnce()
  })

  it('suspendPolicy transitions to suspended', async () => {
    const result = await svc.suspendPolicy(ULID)
    expect(result.status).toBe('suspended')
  })

  it('revokePolicy transitions to revoked', async () => {
    const result = await svc.revokePolicy(ULID)
    expect(result.status).toBe('revoked')
  })

  it('getPolicy returns policy or null', async () => {
    const result = await svc.getPolicy(POLICY_ID)
    expect(result?.policyId).toBe(POLICY_ID)
  })
})

// ── GlobalOwnershipAuthority ─────────────────────────────────────────────────

describe('GlobalOwnershipAuthority', () => {
  let ownershipRepo: GlobalOwnershipRepository
  let audit: GovernanceContinuityAuditRepository
  let bus: GlobalGovernanceEventBus
  let svc: GlobalOwnershipAuthority

  beforeEach(() => {
    const ownership = {
      id: ULID, resourceId: RESOURCE_ID, ownershipType: 'exclusive' as const,
      status: 'claimed' as const, ownerServerId: 'server-1',
      ownershipData: {}, expiresAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    ownershipRepo = {
      upsert:          vi.fn().mockResolvedValue(ownership),
      findByResourceId: vi.fn().mockResolvedValue(ownership),
      transfer:        vi.fn().mockResolvedValue({ ...ownership, status: 'transferred', ownerServerId: 'server-2' }),
      release:         vi.fn().mockResolvedValue({ ...ownership, status: 'released' }),
      cleanupStale:    vi.fn().mockResolvedValue(0),
    } as unknown as GlobalOwnershipRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new GlobalOwnershipAuthority(ownershipRepo, audit, bus)
  })

  it('claimOwnership upserts ownership record', async () => {
    const result = await svc.claimOwnership({
      resourceId: RESOURCE_ID, ownershipType: 'exclusive', ownerServerId: 'server-1',
    })
    expect(result.resourceId).toBe(RESOURCE_ID)
    expect(ownershipRepo.upsert).toHaveBeenCalledOnce()
  })

  it('releaseOwnership transitions to released', async () => {
    const result = await svc.releaseOwnership(RESOURCE_ID)
    expect(result.status).toBe('released')
  })

  it('getOwnership returns record or null', async () => {
    const result = await svc.getOwnership(RESOURCE_ID)
    expect(result?.resourceId).toBe(RESOURCE_ID)
  })
})

// ── GovernanceContinuityService ──────────────────────────────────────────────

describe('GovernanceContinuityService', () => {
  let directiveRepo: GlobalGovernanceRepository
  let arbitrationRepo: CrossSystemArbitrationRepository
  let consensusRepo: RuntimeConsensusRepository
  let policyRepo: GlobalPolicyRepository
  let ownershipRepo: GlobalOwnershipRepository
  let audit: GovernanceContinuityAuditRepository
  let bus: GlobalGovernanceEventBus
  let svc: GovernanceContinuityService

  beforeEach(() => {
    directiveRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(5),
    } as unknown as GlobalGovernanceRepository
    arbitrationRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as CrossSystemArbitrationRepository
    consensusRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as RuntimeConsensusRepository
    policyRepo = {
      upsert: vi.fn(), findByPolicyId: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as GlobalPolicyRepository
    ownershipRepo = {
      upsert: vi.fn(), findByResourceId: vi.fn(), transfer: vi.fn(), release: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as GlobalOwnershipRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new GovernanceContinuityService(directiveRepo, arbitrationRepo, consensusRepo, policyRepo, ownershipRepo, audit, bus)
  })

  it('cleanupStale returns counts for directives, arbitrations, consensuses, policies, ownerships', async () => {
    const result = await svc.cleanupStale(300000)
    expect(result.directives).toBe(5)
    expect(result.arbitrations).toBe(3)
    expect(result.consensuses).toBe(2)
    expect(result.policies).toBe(1)
    expect(result.ownerships).toBe(0)
  })
})
