import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  GovernanceRuntimeService,
  PoliticalElectionService,
  LegislativeRuntimeService,
  CivicInfluenceService,
  AutonomousPolicyService,
  GovernanceRecoveryService,
} from '@atc/governance-runtime'
import type {
  GovernanceRuntimeRepository,
  ElectionRepository,
  LegislativeRepository,
  CivicInfluenceRepository,
  PolicyRepository,
  GovernanceAuditRepository,
  GovernanceRuntimeEventBus,
} from '@atc/governance-runtime'

const ULID            = '01JABCDEFGHJKMNPQRST'
const GOVERNANCE_ID   = 'GOV_001'
const ELECTION_ID     = 'ELEC_001'
const LEGISLATION_ID  = 'LEG_001'
const ENTITY_ID       = 'ENTITY_001'
const POLICY_ID       = 'POL_001'
const REGION_ID       = 'REGION_001'

function mockAudit(): GovernanceAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as GovernanceAuditRepository
}

function mockBus(): GovernanceRuntimeEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── GovernanceRuntimeService ─────────────────────────────────────────────────

describe('GovernanceRuntimeService', () => {
  let governanceRepo: GovernanceRuntimeRepository
  let audit: GovernanceAuditRepository
  let bus: GovernanceRuntimeEventBus
  let svc: GovernanceRuntimeService

  beforeEach(() => {
    const governance = {
      id: ULID, governanceId: GOVERNANCE_ID, governanceType: 'democracy' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      regionId: REGION_ID, governanceNonce: 'nonce-1',
      createdAt: new Date(), updatedAt: new Date(), governanceData: {},
    }
    governanceRepo = {
      create:       vi.fn().mockResolvedValue(governance),
      findById:     vi.fn().mockResolvedValue(governance),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string) =>
        Promise.resolve({ ...governance, status })
      ),
      listActive:   vi.fn().mockResolvedValue([governance]),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as GovernanceRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new GovernanceRuntimeService(governanceRepo, audit, bus)
  })

  it('createGovernance creates an active governance', async () => {
    const result = await svc.createGovernance({
      governanceId: GOVERNANCE_ID, governanceType: 'democracy',
      ownerServerId: 'server-1', governanceNonce: 'nonce-1',
    })
    expect(result.governanceId).toBe(GOVERNANCE_ID)
    expect(result.status).toBe('active')
    expect(governanceRepo.create).toHaveBeenCalledOnce()
  })

  it('suspendGovernance transitions to suspended', async () => {
    const result = await svc.suspendGovernance(ULID)
    expect(result.status).toBe('suspended')
    expect(governanceRepo.updateStatus).toHaveBeenCalledWith(ULID, 'suspended')
  })

  it('getGovernance returns governance or null', async () => {
    const result = await svc.getGovernance(ULID)
    expect(result?.governanceId).toBe(GOVERNANCE_ID)
  })

  it('listActiveGovernances returns array', async () => {
    const result = await svc.listActiveGovernances()
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
  })
})

// ── PoliticalElectionService ─────────────────────────────────────────────────

describe('PoliticalElectionService', () => {
  let electionRepo: ElectionRepository
  let audit: GovernanceAuditRepository
  let bus: GovernanceRuntimeEventBus
  let svc: PoliticalElectionService

  beforeEach(() => {
    const election = {
      id: ULID, electionId: ELECTION_ID, electionType: 'general' as const,
      status: 'open' as const, ownerServerId: 'server-1',
      regionId: REGION_ID, electionNonce: 'nonce-1',
      candidateData: {}, resultData: null, closedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    electionRepo = {
      create:       vi.fn().mockResolvedValue(election),
      findById:     vi.fn().mockResolvedValue(election),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, closedAt?: Date) =>
        Promise.resolve({ ...election, status, closedAt: closedAt ?? null })
      ),
      listActive:   vi.fn().mockResolvedValue([election]),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as ElectionRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new PoliticalElectionService(electionRepo, audit, bus)
  })

  it('startElection creates an open election', async () => {
    const result = await svc.startElection({
      electionId: ELECTION_ID, electionType: 'general',
      ownerServerId: 'server-1', regionId: REGION_ID, electionNonce: 'nonce-1',
    })
    expect(result.electionId).toBe(ELECTION_ID)
    expect(result.status).toBe('open')
  })

  it('closeElection transitions to closed', async () => {
    const result = await svc.closeElection(ULID)
    expect(result.status).toBe('closed')
  })

  it('cancelElection transitions to cancelled', async () => {
    const result = await svc.cancelElection(ULID)
    expect(result.status).toBe('cancelled')
  })

  it('getElection returns election or null', async () => {
    const result = await svc.getElection(ULID)
    expect(result?.electionId).toBe(ELECTION_ID)
  })
})

// ── LegislativeRuntimeService ────────────────────────────────────────────────

describe('LegislativeRuntimeService', () => {
  let legislativeRepo: LegislativeRepository
  let audit: GovernanceAuditRepository
  let bus: GovernanceRuntimeEventBus
  let svc: LegislativeRuntimeService

  beforeEach(() => {
    const legislation = {
      id: ULID, legislationId: LEGISLATION_ID, legislationType: 'law' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      regionId: REGION_ID, legislationNonce: 'nonce-1',
      legislationData: {}, enactedAt: new Date(), expiresAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    legislativeRepo = {
      create:       vi.fn().mockResolvedValue(legislation),
      findById:     vi.fn().mockResolvedValue(legislation),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string) =>
        Promise.resolve({ ...legislation, status })
      ),
      listActive:   vi.fn().mockResolvedValue([legislation]),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as LegislativeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new LegislativeRuntimeService(legislativeRepo, audit, bus)
  })

  it('enactLegislation creates active legislation', async () => {
    const result = await svc.enactLegislation({
      legislationId: LEGISLATION_ID, legislationType: 'law',
      ownerServerId: 'server-1', legislationNonce: 'nonce-1',
    })
    expect(result.legislationId).toBe(LEGISLATION_ID)
    expect(result.status).toBe('active')
  })

  it('repealLegislation transitions to repealed', async () => {
    const result = await svc.repealLegislation(ULID)
    expect(result.status).toBe('repealed')
  })

  it('getLegislation returns legislation or null', async () => {
    const result = await svc.getLegislation(ULID)
    expect(result?.legislationId).toBe(LEGISLATION_ID)
  })
})

// ── CivicInfluenceService ────────────────────────────────────────────────────

describe('CivicInfluenceService', () => {
  let civicInfluenceRepo: CivicInfluenceRepository
  let audit: GovernanceAuditRepository
  let bus: GovernanceRuntimeEventBus
  let svc: CivicInfluenceService

  beforeEach(() => {
    const influence = {
      id: ULID, entityId: ENTITY_ID, influenceType: 'political' as const,
      influenceScore: 75.5, ownerServerId: 'server-1',
      regionId: REGION_ID, influenceData: {},
      createdAt: new Date(), updatedAt: new Date(),
    }
    civicInfluenceRepo = {
      upsert:          vi.fn().mockResolvedValue(influence),
      findByEntity:    vi.fn().mockResolvedValue(influence),
      cleanupInactive: vi.fn().mockResolvedValue(0),
    } as unknown as CivicInfluenceRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new CivicInfluenceService(civicInfluenceRepo, audit, bus)
  })

  it('upsertInfluence upserts influence record', async () => {
    const result = await svc.upsertInfluence({
      entityId: ENTITY_ID, influenceType: 'political',
      influenceScore: 75.5, ownerServerId: 'server-1',
    })
    expect(result.entityId).toBe(ENTITY_ID)
    expect(civicInfluenceRepo.upsert).toHaveBeenCalledOnce()
  })

  it('getInfluence returns influence or null', async () => {
    const result = await svc.getInfluence(ENTITY_ID)
    expect(result?.entityId).toBe(ENTITY_ID)
  })
})

// ── AutonomousPolicyService ──────────────────────────────────────────────────

describe('AutonomousPolicyService', () => {
  let policyRepo: PolicyRepository
  let audit: GovernanceAuditRepository
  let bus: GovernanceRuntimeEventBus
  let svc: AutonomousPolicyService

  beforeEach(() => {
    const policy = {
      id: ULID, policyId: POLICY_ID, policyType: 'economic' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      regionId: REGION_ID, policyNonce: 'nonce-1',
      policyData: {}, appliedAt: new Date(), expiresAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    policyRepo = {
      create:       vi.fn().mockResolvedValue(policy),
      findById:     vi.fn().mockResolvedValue(policy),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string) =>
        Promise.resolve({ ...policy, status })
      ),
      listActive:   vi.fn().mockResolvedValue([policy]),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as PolicyRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new AutonomousPolicyService(policyRepo, audit, bus)
  })

  it('applyPolicy creates active policy', async () => {
    const result = await svc.applyPolicy({
      policyId: POLICY_ID, policyType: 'economic',
      ownerServerId: 'server-1', policyNonce: 'nonce-1',
    })
    expect(result.policyId).toBe(POLICY_ID)
    expect(result.status).toBe('active')
  })

  it('revokePolicy transitions to revoked', async () => {
    const result = await svc.revokePolicy(ULID)
    expect(result.status).toBe('revoked')
  })

  it('getPolicy returns policy or null', async () => {
    const result = await svc.getPolicy(ULID)
    expect(result?.policyId).toBe(POLICY_ID)
  })
})

// ── GovernanceRecoveryService ────────────────────────────────────────────────

describe('GovernanceRecoveryService', () => {
  let governanceRepo: GovernanceRuntimeRepository
  let electionRepo: ElectionRepository
  let legislativeRepo: LegislativeRepository
  let policyRepo: PolicyRepository
  let audit: GovernanceAuditRepository
  let bus: GovernanceRuntimeEventBus
  let svc: GovernanceRecoveryService

  beforeEach(() => {
    governanceRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      listActive: vi.fn(), cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as GovernanceRuntimeRepository
    electionRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      listActive: vi.fn(), cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as ElectionRepository
    legislativeRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      listActive: vi.fn(), cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as LegislativeRepository
    policyRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      listActive: vi.fn(), cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as PolicyRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new GovernanceRecoveryService(governanceRepo, electionRepo, legislativeRepo, policyRepo, audit, bus)
  })

  it('cleanupStale returns counts for all governance entities', async () => {
    const result = await svc.cleanupStale(300000)
    expect(result.governances).toBe(3)
    expect(result.elections).toBe(2)
    expect(result.legislations).toBe(1)
    expect(result.policies).toBe(4)
  })
})
