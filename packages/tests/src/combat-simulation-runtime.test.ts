import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CombatSimulationService,
  BallisticsRuntimeService,
  TacticalDamageService,
  SuppressionRuntimeService,
  ArmorPenetrationService,
  CombatRecoveryService,
} from '@atc/combat-simulation-runtime'
import type {
  CombatRuntimeRepository,
  BallisticsRuntimeRepository,
  TacticalDamageRepository,
  SuppressionRuntimeRepository,
  ArmorRuntimeRepository,
  CombatAuditRepository,
  CombatSimulationEventBus,
} from '@atc/combat-simulation-runtime'

const SESSION_ID = 'SESSION_001'
const ENTITY_ID  = 'ENTITY_001'
const ULID       = '01JABCDEFGHJKMNPQRST'

function mockAudit(): CombatAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as CombatAuditRepository
}

function mockBus(): CombatSimulationEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── CombatSimulationService ──────────────────────────────────────────────────

describe('CombatSimulationService', () => {
  let combatRepo: CombatRuntimeRepository
  let audit: CombatAuditRepository
  let bus: CombatSimulationEventBus
  let svc: CombatSimulationService

  beforeEach(() => {
    const session = {
      id: ULID, sessionId: SESSION_ID, combatType: 'pvp' as const,
      entityId: ENTITY_ID, status: 'active' as const,
      ownerServerId: 'server-1', startedAt: new Date(), endedAt: null,
      regionId: null, combatData: '{}', createdAt: new Date(), updatedAt: new Date(),
    }
    combatRepo = {
      create:        vi.fn().mockResolvedValue(session),
      findById:      vi.fn().mockResolvedValue(session),
      updateStatus:  vi.fn().mockResolvedValue({ ...session, status: 'ended' }),
      listActive:    vi.fn().mockResolvedValue([session]),
      cleanupStale:  vi.fn().mockResolvedValue(3),
    } as unknown as CombatRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new CombatSimulationService(combatRepo, audit, bus)
  })

  it('startCombat creates session and appends audit', async () => {
    const result = await svc.startCombat({
      sessionId: SESSION_ID, combatType: 'pvp', entityId: ENTITY_ID,
      ownerServerId: 'server-1', sessionNonce: 'nonce-1',
    })
    expect(result.sessionId).toBe(SESSION_ID)
    expect(vi.mocked(audit.append)).toHaveBeenCalledOnce()
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:combat:session:started', expect.any(Object))
  })

  it('endCombat transitions status to ended', async () => {
    const result = await svc.endCombat(ULID)
    expect(result.status).toBe('ended')
    expect(vi.mocked(combatRepo.updateStatus)).toHaveBeenCalledWith(ULID, 'ended', expect.any(Date))
  })

  it('getSession returns null when not found', async () => {
    vi.mocked(combatRepo.findById).mockResolvedValue(null)
    const result = await svc.getSession('MISSING')
    expect(result).toBeNull()
  })

  it('cleanupStale returns purged count', async () => {
    const count = await svc.cleanupStale(60000)
    expect(count).toBe(3)
  })
})

// ── BallisticsRuntimeService ─────────────────────────────────────────────────

describe('BallisticsRuntimeService', () => {
  let ballisticsRepo: BallisticsRuntimeRepository
  let audit: CombatAuditRepository
  let bus: CombatSimulationEventBus
  let svc: BallisticsRuntimeService

  beforeEach(() => {
    const record = {
      id: ULID, sessionId: SESSION_ID, entityId: ENTITY_ID,
      ballisticType: 'bullet' as const, isResolved: false,
      velocity: 900, penetrationDepth: 0.5,
      ownerServerId: 'server-1', createdAt: new Date(),
      trajectoryData: '{}', impactData: '{}',
    }
    ballisticsRepo = {
      create:                vi.fn().mockResolvedValue(record),
      markResolved:          vi.fn().mockResolvedValue({ ...record, isResolved: true }),
      listUnresolvedBySession: vi.fn().mockResolvedValue([record]),
    } as unknown as BallisticsRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new BallisticsRuntimeService(ballisticsRepo, audit, bus)
  })

  it('recordImpact emits event', async () => {
    const result = await svc.recordImpact({
      sessionId: SESSION_ID, entityId: ENTITY_ID,
      ballisticType: 'bullet', ownerServerId: 'server-1',
    })
    expect(result.id).toBe(ULID)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:combat:ballistic:impact', expect.any(Object))
  })

  it('resolveImpact marks record resolved', async () => {
    const result = await svc.resolveImpact(ULID)
    expect(result.isResolved).toBe(true)
  })

  it('listPendingBySession returns unresolved records', async () => {
    const results = await svc.listPendingBySession(SESSION_ID)
    expect(results).toHaveLength(1)
  })
})

// ── TacticalDamageService ────────────────────────────────────────────────────

describe('TacticalDamageService', () => {
  let damageRepo: TacticalDamageRepository
  let audit: CombatAuditRepository
  let bus: CombatSimulationEventBus
  let svc: TacticalDamageService

  beforeEach(() => {
    const record = {
      id: ULID, sessionId: SESSION_ID, entityId: ENTITY_ID,
      damageType: 'ballistic' as const, damageAmount: 45,
      armorPenetration: 0.3, isProcessed: false,
      ownerServerId: 'server-1', createdAt: new Date(), damageData: '{}',
    }
    damageRepo = {
      create:                  vi.fn().mockResolvedValue(record),
      markProcessed:           vi.fn().mockResolvedValue({ ...record, isProcessed: true }),
      listUnprocessedBySession: vi.fn().mockResolvedValue([record]),
    } as unknown as TacticalDamageRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new TacticalDamageService(damageRepo, audit, bus)
  })

  it('applyDamage creates record and emits event', async () => {
    const result = await svc.applyDamage({
      sessionId: SESSION_ID, entityId: ENTITY_ID,
      damageType: 'ballistic', damageAmount: 45,
      armorPenetration: 0.3, ownerServerId: 'server-1',
    })
    expect(result.damageAmount).toBe(45)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:combat:damage:applied', expect.any(Object))
  })
})

// ── SuppressionRuntimeService ────────────────────────────────────────────────

describe('SuppressionRuntimeService', () => {
  let suppressionRepo: SuppressionRuntimeRepository
  let audit: CombatAuditRepository
  let bus: CombatSimulationEventBus
  let svc: SuppressionRuntimeService

  beforeEach(() => {
    const record = {
      id: ULID, entityId: ENTITY_ID,
      suppressionType: 'gunfire' as const, suppressionLevel: 75,
      isActive: true, ownerServerId: 'server-1',
      regionId: null, expiresAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    suppressionRepo = {
      upsert:         vi.fn().mockResolvedValue(record),
      findByEntityId: vi.fn().mockResolvedValue(record),
      deactivate:     vi.fn().mockResolvedValue(undefined),
      cleanupExpired: vi.fn().mockResolvedValue(2),
    } as unknown as SuppressionRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new SuppressionRuntimeService(suppressionRepo, audit, bus)
  })

  it('applySuppression upserts and emits event', async () => {
    const result = await svc.applySuppression({
      entityId: ENTITY_ID, suppressionType: 'gunfire',
      suppressionLevel: 75, ownerServerId: 'server-1',
    })
    expect(result.suppressionLevel).toBe(75)
    expect(vi.mocked(bus.emit)).toHaveBeenCalled()
  })

  it('clearSuppression deactivates and emits cleared event', async () => {
    await svc.clearSuppression(ENTITY_ID)
    expect(vi.mocked(suppressionRepo.deactivate)).toHaveBeenCalledWith(ENTITY_ID)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:combat:suppression:cleared', { entityId: ENTITY_ID })
  })
})

// ── ArmorPenetrationService ──────────────────────────────────────────────────

describe('ArmorPenetrationService', () => {
  let armorRepo: ArmorRuntimeRepository
  let bus: CombatSimulationEventBus
  let svc: ArmorPenetrationService

  beforeEach(() => {
    const record = {
      id: ULID, entityId: ENTITY_ID,
      armorType: 'medium' as const, protectionLevel: 60,
      penetrationThreshold: 30, currentIntegrity: 80,
      isActive: true, ownerServerId: 'server-1',
      createdAt: new Date(), updatedAt: new Date(), armorData: '{}',
    }
    armorRepo = {
      upsert:          vi.fn().mockResolvedValue(record),
      findByEntityId:  vi.fn().mockResolvedValue(record),
      updateIntegrity: vi.fn().mockResolvedValue({ ...record, currentIntegrity: 60 }),
      deactivate:      vi.fn().mockResolvedValue(undefined),
    } as unknown as ArmorRuntimeRepository
    bus = mockBus()
    svc = new ArmorPenetrationService(armorRepo, bus)
  })

  it('upsertArmor creates/updates armor record', async () => {
    const result = await svc.upsertArmor({
      entityId: ENTITY_ID, armorType: 'medium',
      protectionLevel: 60, penetrationThreshold: 30,
      currentIntegrity: 80, ownerServerId: 'server-1',
    })
    expect(result.armorType).toBe('medium')
  })

  it('applyDamageToArmor reduces integrity and emits event', async () => {
    const result = await svc.applyDamageToArmor(ENTITY_ID, 20)
    expect(result).not.toBeNull()
    expect(vi.mocked(armorRepo.updateIntegrity)).toHaveBeenCalledWith(ENTITY_ID, 60)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:combat:armor:damaged', expect.any(Object))
  })

  it('applyDamageToArmor returns null when no armor', async () => {
    vi.mocked(armorRepo.findByEntityId).mockResolvedValue(null)
    const result = await svc.applyDamageToArmor(ENTITY_ID, 20)
    expect(result).toBeNull()
  })
})

// ── CombatRecoveryService ────────────────────────────────────────────────────

describe('CombatRecoveryService', () => {
  let combatRepo: CombatRuntimeRepository
  let ballisticsRepo: BallisticsRuntimeRepository
  let damageRepo: TacticalDamageRepository
  let suppressionRepo: SuppressionRuntimeRepository
  let audit: CombatAuditRepository
  let bus: CombatSimulationEventBus
  let svc: CombatRecoveryService

  beforeEach(() => {
    combatRepo      = { cleanupStale: vi.fn().mockResolvedValue(5), listActive: vi.fn().mockResolvedValue([]), updateStatus: vi.fn().mockResolvedValue({}) } as unknown as CombatRuntimeRepository
    ballisticsRepo  = {} as unknown as BallisticsRuntimeRepository
    damageRepo      = {} as unknown as TacticalDamageRepository
    suppressionRepo = { cleanupExpired: vi.fn().mockResolvedValue(2) } as unknown as SuppressionRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new CombatRecoveryService(combatRepo, ballisticsRepo, damageRepo, suppressionRepo, audit, bus)
  })

  it('cleanupStale returns counts for sessions and suppression', async () => {
    const result = await svc.cleanupStale(60000)
    expect(result.sessions).toBe(5)
    expect(result.suppression).toBe(2)
  })

  it('recoverEntity returns 0 when no active sessions', async () => {
    const result = await svc.recoverEntity(ENTITY_ID)
    expect(result.recovered).toBe(0)
  })
})
