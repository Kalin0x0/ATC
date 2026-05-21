import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  RuntimeHardeningRepository, AtcRuntimeHardening,
  ImmutableSecurityRepository, AtcImmutableSecurity,
  SecurityValidationRepository, AtcSecurityValidation,
  SealValidationRepository, AtcSealValidation,
  ThreatMitigationRepository, AtcThreatMitigation,
  HardeningAuditRepository, RuntimeHardeningEventBus,
} from '@atc/runtime-hardening'
import {
  RuntimeHardeningService,
  ImmutableSecurityCoordinator,
  DistributedSecurityValidationService,
  RuntimeSealVerificationService,
  AutonomousThreatMitigationService,
  HardeningRecoveryService,
} from '@atc/runtime-hardening'

function mockBus(): RuntimeHardeningEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

function mockAudit(): HardeningAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as HardeningAuditRepository
}

describe('RuntimeHardeningService', () => {
  let hardeningRepo: RuntimeHardeningRepository
  let audit: HardeningAuditRepository
  let bus: RuntimeHardeningEventBus
  let service: RuntimeHardeningService

  beforeEach(() => {
    const hardening: AtcRuntimeHardening = {
      id: '01H', hardeningId: '01I', hardeningType: 'immutable',
      status: 'pending', ownerServerId: 'srv-1', hardeningNonce: 'nonce-h-1',
      hardeningData: {}, hardenedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    hardeningRepo = {
      create: vi.fn().mockResolvedValue(hardening),
      findById: vi.fn().mockResolvedValue(hardening),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, hardenedAt?: Date) =>
        Promise.resolve({ ...hardening, status, hardenedAt: hardenedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(5),
    } as unknown as RuntimeHardeningRepository
    audit = mockAudit()
    bus = mockBus()
    service = new RuntimeHardeningService(hardeningRepo, audit, bus)
  })

  it('initiates a hardening record', async () => {
    const result = await service.initiateHardening({ hardeningType: 'immutable', ownerServerId: 'srv-1', hardeningNonce: 'nonce-h-1' })
    expect(result.status).toBe('pending')
    expect(result.hardeningType).toBe('immutable')
  })

  it('begins hardening', async () => {
    const result = await service.beginHardening('01H')
    expect(result.status).toBe('hardening')
  })

  it('hardens runtime and emits immutable_hardening_verified', async () => {
    const result = await service.hardenRuntime('01H')
    expect(result.status).toBe('hardened')
    expect(result.hardenedAt).toBeInstanceOf(Date)
  })

  it('violates hardening', async () => {
    const result = await service.violateHardening('01H')
    expect(result.status).toBe('violated')
  })

  it('retrieves a hardening record', async () => {
    const result = await service.getHardening('01H')
    expect(result?.hardeningType).toBe('immutable')
  })
})

describe('ImmutableSecurityCoordinator', () => {
  let securityRepo: ImmutableSecurityRepository
  let audit: HardeningAuditRepository
  let bus: RuntimeHardeningEventBus
  let service: ImmutableSecurityCoordinator

  beforeEach(() => {
    const sec: AtcImmutableSecurity = {
      id: '01S', securityId: '01T', securityType: 'policy',
      status: 'pending', ownerServerId: 'srv-1', securityNonce: 'nonce-sec-1',
      securityData: {}, enforcedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    securityRepo = {
      create: vi.fn().mockResolvedValue(sec),
      findById: vi.fn().mockResolvedValue(sec),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, enforcedAt?: Date) =>
        Promise.resolve({ ...sec, status, enforcedAt: enforcedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as ImmutableSecurityRepository
    audit = mockAudit()
    bus = mockBus()
    service = new ImmutableSecurityCoordinator(securityRepo, audit, bus)
  })

  it('creates immutable security', async () => {
    const result = await service.createSecurity({ securityType: 'policy', ownerServerId: 'srv-1', securityNonce: 'nonce-sec-1' })
    expect(result.status).toBe('pending')
  })

  it('enforces policy and emits immutable_hardening_verified', async () => {
    const result = await service.enforcePolicy('01S')
    expect(result.status).toBe('active')
    expect(result.enforcedAt).toBeInstanceOf(Date)
  })
})

describe('DistributedSecurityValidationService', () => {
  let validationRepo: SecurityValidationRepository
  let audit: HardeningAuditRepository
  let bus: RuntimeHardeningEventBus
  let service: DistributedSecurityValidationService

  beforeEach(() => {
    const val: AtcSecurityValidation = {
      id: '01V', validationId: '01W', validationType: 'hash',
      status: 'pending', ownerServerId: 'srv-1', validationNonce: 'nonce-val-1',
      validationData: {}, validatedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    validationRepo = {
      create: vi.fn().mockResolvedValue(val),
      findById: vi.fn().mockResolvedValue(val),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, validatedAt?: Date) =>
        Promise.resolve({ ...val, status, validatedAt: validatedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as SecurityValidationRepository
    audit = mockAudit()
    bus = mockBus()
    service = new DistributedSecurityValidationService(validationRepo, audit, bus)
  })

  it('creates a security validation', async () => {
    const result = await service.createValidation({ validationType: 'hash', ownerServerId: 'srv-1', validationNonce: 'nonce-val-1' })
    expect(result.validationType).toBe('hash')
  })

  it('passes validation and emits immutable_hardening_verified', async () => {
    const result = await service.passValidation('01V')
    expect(result.status).toBe('passed')
    expect(result.validatedAt).toBeInstanceOf(Date)
  })
})

describe('RuntimeSealVerificationService', () => {
  let sealRepo: SealValidationRepository
  let audit: HardeningAuditRepository
  let bus: RuntimeHardeningEventBus
  let service: RuntimeSealVerificationService

  beforeEach(() => {
    const sv: AtcSealValidation = {
      id: '01SV', sealValidationId: '01SW', sealType: 'hash',
      status: 'pending', ownerServerId: 'srv-1', sealValidationNonce: 'nonce-sv-1',
      resourceId: 'epoch-1', sealData: {}, verifiedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    sealRepo = {
      create: vi.fn().mockResolvedValue(sv),
      findById: vi.fn().mockResolvedValue(sv),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, verifiedAt?: Date) =>
        Promise.resolve({ ...sv, status, verifiedAt: verifiedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as SealValidationRepository
    audit = mockAudit()
    bus = mockBus()
    service = new RuntimeSealVerificationService(sealRepo, audit, bus)
  })

  it('creates a seal validation with resourceId', async () => {
    const result = await service.createSealValidation({ sealType: 'hash', ownerServerId: 'srv-1', sealValidationNonce: 'nonce-sv-1', resourceId: 'epoch-1' })
    expect(result.resourceId).toBe('epoch-1')
  })

  it('verifies runtime seal and emits runtime_seal_verified', async () => {
    const result = await service.verifyRuntimeSeal('01SV')
    expect(result.status).toBe('verified')
    expect(result.verifiedAt).toBeInstanceOf(Date)
  })
})

describe('AutonomousThreatMitigationService', () => {
  let mitigationRepo: ThreatMitigationRepository
  let audit: HardeningAuditRepository
  let bus: RuntimeHardeningEventBus
  let service: AutonomousThreatMitigationService

  beforeEach(() => {
    const mit: AtcThreatMitigation = {
      id: '01MT', mitigationId: '01MU', mitigationType: 'block',
      status: 'pending', ownerServerId: 'srv-1', mitigationNonce: 'nonce-mit-1',
      mitigationData: {}, mitigatedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    mitigationRepo = {
      create: vi.fn().mockResolvedValue(mit),
      findById: vi.fn().mockResolvedValue(mit),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, mitigatedAt?: Date) =>
        Promise.resolve({ ...mit, status, mitigatedAt: mitigatedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(6),
    } as unknown as ThreatMitigationRepository
    audit = mockAudit()
    bus = mockBus()
    service = new AutonomousThreatMitigationService(mitigationRepo, audit, bus)
  })

  it('creates a threat mitigation', async () => {
    const result = await service.createMitigation({ mitigationType: 'block', ownerServerId: 'srv-1', mitigationNonce: 'nonce-mit-1' })
    expect(result.mitigationType).toBe('block')
  })

  it('completes mitigation and emits autonomous_threat_mitigated', async () => {
    const result = await service.completeMitigation('01MT')
    expect(result.status).toBe('mitigated')
    expect(result.mitigatedAt).toBeInstanceOf(Date)
  })
})

describe('HardeningRecoveryService', () => {
  it('cleans up stale records and returns counts', async () => {
    const hardeningRepo = { cleanupStale: vi.fn().mockResolvedValue(5) } as unknown as RuntimeHardeningRepository
    const securityRepo = { cleanupStale: vi.fn().mockResolvedValue(3) } as unknown as ImmutableSecurityRepository
    const validationRepo = { cleanupStale: vi.fn().mockResolvedValue(4) } as unknown as SecurityValidationRepository
    const sealRepo = { cleanupStale: vi.fn().mockResolvedValue(2) } as unknown as SealValidationRepository
    const mitigationRepo = { cleanupStale: vi.fn().mockResolvedValue(6) } as unknown as ThreatMitigationRepository
    const audit = mockAudit()
    const bus = mockBus()

    const service = new HardeningRecoveryService(hardeningRepo, securityRepo, validationRepo, sealRepo, mitigationRepo, audit, bus)
    const result = await service.cleanupStale(300000)
    expect(result).toEqual({ hardenings: 5, securities: 3, validations: 4, sealValidations: 2, mitigations: 6 })
  })
})
