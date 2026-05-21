import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RuntimeIntrusionDetectionService,
  AutonomousProtectionService,
  RuntimeIsolationService,
  SecurityEscalationService,
  ThreatContainmentService,
  RuntimeSecurityRecoveryService,
} from '@atc/security-runtime'
import type {
  RuntimeIntrusionRepository,
  RuntimeThreatRepository,
  RuntimeIsolationRepository,
  SecurityEscalationRepository,
  ThreatContainmentRepository,
  SecurityAuditRepository,
  SecurityRuntimeEventBus,
} from '@atc/security-runtime'

const ULID            = '01JABCDEFGHJKMNPQRST'
const INTRUSION_ID    = 'INTR_001'
const THREAT_ID       = 'THREAT_001'
const ENTITY_ID       = 'ENTITY_001'
const ESCALATION_ID   = 'ESC_001'
const CONTAINMENT_ID  = 'CONT_001'

function mockAudit(): SecurityAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as SecurityAuditRepository
}

function mockBus(): SecurityRuntimeEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── RuntimeIntrusionDetectionService ────────────────────────────────────────

describe('RuntimeIntrusionDetectionService', () => {
  let intrusionRepo: RuntimeIntrusionRepository
  let audit: SecurityAuditRepository
  let bus: SecurityRuntimeEventBus
  let svc: RuntimeIntrusionDetectionService

  beforeEach(() => {
    const intrusion = {
      id: ULID, intrusionId: INTRUSION_ID, intrusionType: 'unauthorized_access' as const,
      severity: 'high' as const, status: 'active' as const, ownerServerId: 'server-1',
      intrusionNonce: 'nonce-1', entityId: ENTITY_ID, sourceNode: 'fivem-server',
      resolvedAt: null, createdAt: new Date(), updatedAt: new Date(), intrusionData: '{}',
    }
    intrusionRepo = {
      create:       vi.fn().mockResolvedValue(intrusion),
      findById:     vi.fn().mockResolvedValue(intrusion),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, resolvedAt?: Date) =>
        Promise.resolve({ ...intrusion, status, resolvedAt: resolvedAt ?? null })
      ),
      listActive:   vi.fn().mockResolvedValue([intrusion]),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as RuntimeIntrusionRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeIntrusionDetectionService(intrusionRepo, audit, bus)
  })

  it('detectIntrusion creates active intrusion', async () => {
    const result = await svc.detectIntrusion({
      intrusionType: 'unauthorized_access', severity: 'high',
      ownerServerId: 'server-1', intrusionNonce: 'nonce-1',
      entityId: ENTITY_ID, sourceNode: 'fivem-server',
    })
    expect(result.intrusionId).toBe(INTRUSION_ID)
    expect(result.status).toBe('active')
    expect(intrusionRepo.create).toHaveBeenCalledOnce()
  })

  it('resolveIntrusion transitions to resolved', async () => {
    const result = await svc.resolveIntrusion(ULID)
    expect(result.status).toBe('resolved')
  })

  it('getIntrusion returns intrusion or null', async () => {
    const result = await svc.getIntrusion(ULID)
    expect(result?.intrusionId).toBe(INTRUSION_ID)
  })

  it('listActiveIntrusions returns array', async () => {
    const result = await svc.listActiveIntrusions()
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
  })
})

// ── AutonomousProtectionService ──────────────────────────────────────────────

describe('AutonomousProtectionService', () => {
  let threatRepo: RuntimeThreatRepository
  let audit: SecurityAuditRepository
  let bus: SecurityRuntimeEventBus
  let svc: AutonomousProtectionService

  beforeEach(() => {
    const threat = {
      id: ULID, threatId: THREAT_ID, threatType: 'exploit' as const,
      severity: 'critical' as const, status: 'active' as const, ownerServerId: 'server-1',
      threatNonce: 'nonce-1', entityId: ENTITY_ID,
      mitigatedAt: null, createdAt: new Date(), updatedAt: new Date(), threatData: '{}',
    }
    threatRepo = {
      create:       vi.fn().mockResolvedValue(threat),
      findById:     vi.fn().mockResolvedValue(threat),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, mitigatedAt?: Date) =>
        Promise.resolve({ ...threat, status, mitigatedAt: mitigatedAt ?? null })
      ),
      listActive:   vi.fn().mockResolvedValue([threat]),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as RuntimeThreatRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new AutonomousProtectionService(threatRepo, audit, bus)
  })

  it('detectThreat creates active threat', async () => {
    const result = await svc.detectThreat({
      threatType: 'exploit', severity: 'critical',
      ownerServerId: 'server-1', threatNonce: 'nonce-1', entityId: ENTITY_ID,
    })
    expect(result.threatId).toBe(THREAT_ID)
    expect(result.status).toBe('active')
  })

  it('mitigateThreat transitions to mitigated', async () => {
    const result = await svc.mitigateThreat(ULID)
    expect(result.status).toBe('mitigated')
  })

  it('getThreat returns threat or null', async () => {
    const result = await svc.getThreat(ULID)
    expect(result?.threatId).toBe(THREAT_ID)
  })
})

// ── RuntimeIsolationService ──────────────────────────────────────────────────

describe('RuntimeIsolationService', () => {
  let isolationRepo: RuntimeIsolationRepository
  let audit: SecurityAuditRepository
  let bus: SecurityRuntimeEventBus
  let svc: RuntimeIsolationService

  beforeEach(() => {
    const isolation = {
      id: ULID, entityId: ENTITY_ID, isolationType: 'full' as const,
      status: 'isolated' as const, ownerServerId: 'server-1',
      createdAt: new Date(), updatedAt: new Date(), isolationData: '{}',
    }
    isolationRepo = {
      upsert:          vi.fn().mockResolvedValue(isolation),
      findByEntity:    vi.fn().mockResolvedValue(isolation),
      release:         vi.fn().mockResolvedValue(undefined),
      cleanupReleased: vi.fn().mockResolvedValue(0),
    } as unknown as RuntimeIsolationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeIsolationService(isolationRepo, audit, bus)
  })

  it('isolateEntity upserts isolation record', async () => {
    const result = await svc.isolateEntity({
      entityId: ENTITY_ID, isolationType: 'full', ownerServerId: 'server-1',
    })
    expect(result.entityId).toBe(ENTITY_ID)
    expect(result.status).toBe('isolated')
  })

  it('releaseIsolation calls release', async () => {
    await svc.releaseIsolation(ENTITY_ID)
    expect(isolationRepo.release).toHaveBeenCalledWith(ENTITY_ID)
  })

  it('getIsolation returns isolation or null', async () => {
    const result = await svc.getIsolation(ENTITY_ID)
    expect(result?.entityId).toBe(ENTITY_ID)
  })
})

// ── SecurityEscalationService ────────────────────────────────────────────────

describe('SecurityEscalationService', () => {
  let escalationRepo: SecurityEscalationRepository
  let audit: SecurityAuditRepository
  let bus: SecurityRuntimeEventBus
  let svc: SecurityEscalationService

  beforeEach(() => {
    const escalation = {
      id: ULID, escalationId: ESCALATION_ID, escalationType: 'admin_review' as const,
      severity: 'high' as const, status: 'pending' as const, ownerServerId: 'server-1',
      escalationNonce: 'nonce-1', entityId: ENTITY_ID,
      resolvedAt: null, createdAt: new Date(), updatedAt: new Date(), escalationData: '{}',
    }
    escalationRepo = {
      create:       vi.fn().mockResolvedValue(escalation),
      findById:     vi.fn().mockResolvedValue(escalation),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, resolvedAt?: Date) =>
        Promise.resolve({ ...escalation, status, resolvedAt: resolvedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as SecurityEscalationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new SecurityEscalationService(escalationRepo, audit, bus)
  })

  it('escalate creates pending escalation', async () => {
    const result = await svc.escalate({
      escalationType: 'admin_review', severity: 'high',
      ownerServerId: 'server-1', escalationNonce: 'nonce-1', entityId: ENTITY_ID,
    })
    expect(result.escalationId).toBe(ESCALATION_ID)
    expect(result.status).toBe('pending')
  })

  it('resolveEscalation transitions to resolved', async () => {
    const result = await svc.resolveEscalation(ULID)
    expect(result.status).toBe('resolved')
  })

  it('getEscalation returns escalation or null', async () => {
    const result = await svc.getEscalation(ULID)
    expect(result?.escalationId).toBe(ESCALATION_ID)
  })
})

// ── ThreatContainmentService ─────────────────────────────────────────────────

describe('ThreatContainmentService', () => {
  let containmentRepo: ThreatContainmentRepository
  let audit: SecurityAuditRepository
  let bus: SecurityRuntimeEventBus
  let svc: ThreatContainmentService

  beforeEach(() => {
    const containment = {
      id: ULID, containmentId: CONTAINMENT_ID, containmentType: 'isolate' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      containmentNonce: 'nonce-1', threatId: THREAT_ID,
      completedAt: null, createdAt: new Date(), updatedAt: new Date(), containmentData: '{}',
    }
    containmentRepo = {
      create:       vi.fn().mockResolvedValue(containment),
      findById:     vi.fn().mockResolvedValue(containment),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...containment, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as ThreatContainmentRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new ThreatContainmentService(containmentRepo, audit, bus)
  })

  it('contain creates active containment', async () => {
    const result = await svc.contain({
      containmentType: 'isolate', ownerServerId: 'server-1',
      containmentNonce: 'nonce-1', threatId: THREAT_ID,
    })
    expect(result.containmentId).toBe(CONTAINMENT_ID)
    expect(result.status).toBe('active')
  })

  it('completeContainment transitions to completed', async () => {
    const result = await svc.completeContainment(ULID)
    expect(result.status).toBe('completed')
  })

  it('failContainment transitions to failed', async () => {
    const result = await svc.failContainment(ULID)
    expect(result.status).toBe('failed')
  })

  it('getContainment returns containment or null', async () => {
    const result = await svc.getContainment(ULID)
    expect(result?.containmentId).toBe(CONTAINMENT_ID)
  })
})

// ── RuntimeSecurityRecoveryService ──────────────────────────────────────────

describe('RuntimeSecurityRecoveryService', () => {
  let intrusionRepo: RuntimeIntrusionRepository
  let threatRepo: RuntimeThreatRepository
  let containmentRepo: ThreatContainmentRepository
  let audit: SecurityAuditRepository
  let bus: SecurityRuntimeEventBus
  let svc: RuntimeSecurityRecoveryService

  beforeEach(() => {
    intrusionRepo = {
      create:       vi.fn(),
      findById:     vi.fn(),
      updateStatus: vi.fn(),
      listActive:   vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as RuntimeIntrusionRepository
    threatRepo = {
      create:       vi.fn(),
      findById:     vi.fn(),
      updateStatus: vi.fn(),
      listActive:   vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as RuntimeThreatRepository
    containmentRepo = {
      create:       vi.fn(),
      findById:     vi.fn(),
      updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as ThreatContainmentRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeSecurityRecoveryService(intrusionRepo, threatRepo, containmentRepo, audit, bus)
  })

  it('cleanupStale returns counts for intrusions, threats, containments', async () => {
    const result = await svc.cleanupStale(300000)
    expect(result.intrusions).toBe(4)
    expect(result.threats).toBe(2)
    expect(result.containments).toBe(1)
  })
})
