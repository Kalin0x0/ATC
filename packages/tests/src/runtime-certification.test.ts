import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RuntimeCertificationService,
  DeterministicValidationService,
  ComplianceEnforcementService,
  RuntimeVerificationService,
  DistributedComplianceCoordinator,
  CertificationRecoveryService,
} from '@atc/runtime-certification'
import type {
  RuntimeCertificationRepository,
  DeterministicValidationRepository,
  RuntimeComplianceRepository,
  VerificationRuntimeRepository,
  ComplianceCoordinationRepository,
  CertificationAuditRepository,
  RuntimeCertificationEventBus,
} from '@atc/runtime-certification'

const ULID             = '01JABCDEFGHJKMNPQRST'
const CERT_ID          = 'CERT_001'
const VALIDATION_ID    = 'VAL_001'
const COMPLIANCE_ID    = 'COMP_001'
const VERIFICATION_ID  = 'VER_001'
const COORDINATION_ID  = 'COORD_001'

function mockAudit(): CertificationAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as CertificationAuditRepository
}

function mockBus(): RuntimeCertificationEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── RuntimeCertificationService ───────────────────────────────────────────────

describe('RuntimeCertificationService', () => {
  let certRepo: RuntimeCertificationRepository
  let audit: CertificationAuditRepository
  let bus: RuntimeCertificationEventBus
  let svc: RuntimeCertificationService

  beforeEach(() => {
    const cert = {
      id: ULID, certificationId: CERT_ID, certificationType: 'runtime' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      certificationNonce: 'nonce-1', certificationData: {}, certifiedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    certRepo = {
      create:       vi.fn().mockResolvedValue(cert),
      findById:     vi.fn().mockResolvedValue(cert),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, certifiedAt?: Date) =>
        Promise.resolve({ ...cert, status, certifiedAt: certifiedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as RuntimeCertificationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeCertificationService(certRepo, audit, bus)
  })

  it('createCertification creates a pending certification', async () => {
    const result = await svc.createCertification({
      certificationType: 'runtime', ownerServerId: 'server-1', certificationNonce: 'nonce-1',
    })
    expect(result.certificationId).toBe(CERT_ID)
    expect(result.status).toBe('pending')
    expect(certRepo.create).toHaveBeenCalledOnce()
  })

  it('certify transitions to certified with timestamp', async () => {
    const result = await svc.certify(ULID)
    expect(result.status).toBe('certified')
    expect(result.certifiedAt).toBeInstanceOf(Date)
  })

  it('revokeCertification transitions to revoked', async () => {
    const result = await svc.revokeCertification(ULID)
    expect(result.status).toBe('revoked')
  })

  it('expireCertification transitions to expired', async () => {
    const result = await svc.expireCertification(ULID)
    expect(result.status).toBe('expired')
  })

  it('failCertification transitions to failed', async () => {
    const result = await svc.failCertification(ULID)
    expect(result.status).toBe('failed')
  })

  it('getCertification returns record or null', async () => {
    const result = await svc.getCertification(ULID)
    expect(result?.certificationId).toBe(CERT_ID)
  })
})

// ── DeterministicValidationService ───────────────────────────────────────────

describe('DeterministicValidationService', () => {
  let validationRepo: DeterministicValidationRepository
  let audit: CertificationAuditRepository
  let bus: RuntimeCertificationEventBus
  let svc: DeterministicValidationService

  beforeEach(() => {
    const validation = {
      id: ULID, validationId: VALIDATION_ID, validationType: 'state' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      validationNonce: 'nonce-1', validationData: {}, validatedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    validationRepo = {
      create:       vi.fn().mockResolvedValue(validation),
      findById:     vi.fn().mockResolvedValue(validation),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, validatedAt?: Date) =>
        Promise.resolve({ ...validation, status, validatedAt: validatedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as DeterministicValidationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new DeterministicValidationService(validationRepo, audit, bus)
  })

  it('createValidation creates a pending validation', async () => {
    const result = await svc.createValidation({
      validationType: 'state', ownerServerId: 'server-1', validationNonce: 'nonce-1',
    })
    expect(result.validationId).toBe(VALIDATION_ID)
    expect(result.status).toBe('pending')
  })

  it('beginValidating transitions to running', async () => {
    const result = await svc.beginValidating(ULID)
    expect(result.status).toBe('running')
  })

  it('passValidation transitions to passed with timestamp', async () => {
    const result = await svc.passValidation(ULID)
    expect(result.status).toBe('passed')
    expect(result.validatedAt).toBeInstanceOf(Date)
  })

  it('failValidation transitions to failed', async () => {
    const result = await svc.failValidation(ULID)
    expect(result.status).toBe('failed')
  })

  it('skipValidation transitions to skipped', async () => {
    const result = await svc.skipValidation(ULID)
    expect(result.status).toBe('skipped')
  })

  it('getValidation returns record or null', async () => {
    const result = await svc.getValidation(ULID)
    expect(result?.validationId).toBe(VALIDATION_ID)
  })
})

// ── ComplianceEnforcementService ──────────────────────────────────────────────

describe('ComplianceEnforcementService', () => {
  let complianceRepo: RuntimeComplianceRepository
  let audit: CertificationAuditRepository
  let bus: RuntimeCertificationEventBus
  let svc: ComplianceEnforcementService

  beforeEach(() => {
    const compliance = {
      id: ULID, complianceId: COMPLIANCE_ID, complianceType: 'policy' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      complianceNonce: 'nonce-1', complianceData: {}, enforcedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    complianceRepo = {
      create:       vi.fn().mockResolvedValue(compliance),
      findById:     vi.fn().mockResolvedValue(compliance),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, enforcedAt?: Date) =>
        Promise.resolve({ ...compliance, status, enforcedAt: enforcedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as RuntimeComplianceRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new ComplianceEnforcementService(complianceRepo, audit, bus)
  })

  it('createCompliance creates an active compliance', async () => {
    const result = await svc.createCompliance({
      complianceType: 'policy', ownerServerId: 'server-1', complianceNonce: 'nonce-1',
    })
    expect(result.complianceId).toBe(COMPLIANCE_ID)
    expect(result.status).toBe('active')
  })

  it('enforceCompliance transitions to enforced with timestamp', async () => {
    const result = await svc.enforceCompliance(ULID)
    expect(result.status).toBe('enforced')
    expect(result.enforcedAt).toBeInstanceOf(Date)
  })

  it('violateCompliance transitions to violated', async () => {
    const result = await svc.violateCompliance(ULID)
    expect(result.status).toBe('violated')
  })

  it('expireCompliance transitions to expired', async () => {
    const result = await svc.expireCompliance(ULID)
    expect(result.status).toBe('expired')
  })

  it('getCompliance returns record or null', async () => {
    const result = await svc.getCompliance(ULID)
    expect(result?.complianceId).toBe(COMPLIANCE_ID)
  })
})

// ── RuntimeVerificationService ────────────────────────────────────────────────

describe('RuntimeVerificationService', () => {
  let verificationRepo: VerificationRuntimeRepository
  let audit: CertificationAuditRepository
  let bus: RuntimeCertificationEventBus
  let svc: RuntimeVerificationService

  beforeEach(() => {
    const verification = {
      id: ULID, verificationId: VERIFICATION_ID, verificationType: 'state' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      verificationNonce: 'nonce-1', verificationData: {}, verifiedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    verificationRepo = {
      create:       vi.fn().mockResolvedValue(verification),
      findById:     vi.fn().mockResolvedValue(verification),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, verifiedAt?: Date) =>
        Promise.resolve({ ...verification, status, verifiedAt: verifiedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as VerificationRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeVerificationService(verificationRepo, audit, bus)
  })

  it('createVerification creates a pending verification', async () => {
    const result = await svc.createVerification({
      verificationType: 'state', ownerServerId: 'server-1', verificationNonce: 'nonce-1',
    })
    expect(result.verificationId).toBe(VERIFICATION_ID)
    expect(result.status).toBe('pending')
  })

  it('beginVerifying transitions to verifying', async () => {
    const result = await svc.beginVerifying(ULID)
    expect(result.status).toBe('verifying')
  })

  it('passVerification transitions to verified with timestamp', async () => {
    const result = await svc.passVerification(ULID)
    expect(result.status).toBe('verified')
    expect(result.verifiedAt).toBeInstanceOf(Date)
  })

  it('failVerification transitions to failed', async () => {
    const result = await svc.failVerification(ULID)
    expect(result.status).toBe('failed')
  })

  it('getVerification returns record or null', async () => {
    const result = await svc.getVerification(ULID)
    expect(result?.verificationId).toBe(VERIFICATION_ID)
  })
})

// ── DistributedComplianceCoordinator ─────────────────────────────────────────

describe('DistributedComplianceCoordinator', () => {
  let coordinationRepo: ComplianceCoordinationRepository
  let audit: CertificationAuditRepository
  let bus: RuntimeCertificationEventBus
  let svc: DistributedComplianceCoordinator

  beforeEach(() => {
    const coordination = {
      id: ULID, coordinationId: COORDINATION_ID, coordinationType: 'distributed' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      coordinationData: {}, syncedAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    }
    coordinationRepo = {
      upsert:               vi.fn().mockResolvedValue(coordination),
      findByCoordinationId: vi.fn().mockResolvedValue(coordination),
      updateStatus:         vi.fn().mockImplementation((_id: string, status: string) =>
        Promise.resolve({ ...coordination, status })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as ComplianceCoordinationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new DistributedComplianceCoordinator(coordinationRepo, audit, bus)
  })

  it('upsertCoordination creates or updates a coordination record', async () => {
    const result = await svc.upsertCoordination({
      coordinationId: COORDINATION_ID, coordinationType: 'distributed', ownerServerId: 'server-1',
    })
    expect(result.coordinationId).toBe(COORDINATION_ID)
    expect(coordinationRepo.upsert).toHaveBeenCalledOnce()
  })

  it('suspendCoordination transitions to suspended', async () => {
    const result = await svc.suspendCoordination(COORDINATION_ID)
    expect(result.status).toBe('suspended')
  })

  it('completeCoordination transitions to completed', async () => {
    const result = await svc.completeCoordination(COORDINATION_ID)
    expect(result.status).toBe('completed')
  })

  it('getCoordination returns record or null', async () => {
    const result = await svc.getCoordination(COORDINATION_ID)
    expect(result?.coordinationId).toBe(COORDINATION_ID)
  })
})

// ── CertificationRecoveryService ─────────────────────────────────────────────

describe('CertificationRecoveryService', () => {
  let certRepo: RuntimeCertificationRepository
  let validationRepo: DeterministicValidationRepository
  let complianceRepo: RuntimeComplianceRepository
  let verificationRepo: VerificationRuntimeRepository
  let coordinationRepo: ComplianceCoordinationRepository
  let audit: CertificationAuditRepository
  let bus: RuntimeCertificationEventBus
  let svc: CertificationRecoveryService

  beforeEach(() => {
    certRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(5),
    } as unknown as RuntimeCertificationRepository
    validationRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as DeterministicValidationRepository
    complianceRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as RuntimeComplianceRepository
    verificationRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as VerificationRuntimeRepository
    coordinationRepo = {
      upsert: vi.fn(), findByCoordinationId: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as ComplianceCoordinationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new CertificationRecoveryService(certRepo, validationRepo, complianceRepo, verificationRepo, coordinationRepo, audit, bus)
  })

  it('cleanupStale returns counts for all domains', async () => {
    const result = await svc.cleanupStale(300000)
    expect(result.certifications).toBe(5)
    expect(result.validations).toBe(3)
    expect(result.compliances).toBe(2)
    expect(result.verifications).toBe(1)
    expect(result.coordinations).toBe(4)
  })
})
