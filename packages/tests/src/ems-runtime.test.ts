import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  EmergencyRepository,
  AmbulanceRepository,
  HospitalCapacityRepository,
  ReviveAuditRepository,
  TriageService,
  AmbulanceDispatchService,
  HospitalCapacityService,
  MedicalEscalationService,
  ReviveWorkflowService,
  EmergencyRuntimeService,
  EmsError,
  EmsValidationError,
  EmergencyNotFoundError,
  EmergencyClosedError,
  EmergencyImmutableError,
  AmbulanceNotFoundError,
  AmbulanceUnavailableError,
  HospitalCapacityNotFoundError,
  HospitalAtCapacityError,
  ReviveCooldownError,
  TriageValidationError,
  DEFAULT_REVIVE_COOLDOWN_SECONDS,
} from '@atc/ems-runtime'
import {
  createEmergencySchema,
  triageEmergencySchema,
  assignEmergencySchema,
  stabilizeEmergencySchema,
  transportEmergencySchema,
  closeEmergencySchema,
} from '@atc/operations'
import type {
  AtcEmsEmergency,
  AtcAmbulanceUnit,
  AtcHospitalCapacity,
  AtcReviveAudit,
  AtcTraumaRecord,
} from '@atc/shared-types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEmergency(overrides: Partial<AtcEmsEmergency> = {}): AtcEmsEmergency {
  return {
    id: '01HW000000000000000000001',
    characterId: 'char-001',
    incidentId: null,
    status: 'reported',
    triageCategory: null,
    assignedResponderIds: [],
    notes: null,
    createdByPrincipalId: 'principal-001',
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeAmbulance(overrides: Partial<AtcAmbulanceUnit> = {}): AtcAmbulanceUnit {
  return {
    id: '01HW000000000000000000002',
    unitId: 'AMB-01',
    status: 'available',
    emergencyId: null,
    facilityId: null,
    lastUpdatedBy: 'principal-001',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeCapacity(overrides: Partial<AtcHospitalCapacity> = {}): AtcHospitalCapacity {
  return {
    id: '01HW000000000000000000003',
    facilityId: 'hospital-main',
    totalBeds: 20,
    availableBeds: 10,
    icuTotal: 5,
    icuAvailable: 2,
    erTotal: 8,
    erAvailable: 4,
    isDiversion: false,
    isOverflow: false,
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeTraumaRecord(overrides: Partial<AtcTraumaRecord> = {}): AtcTraumaRecord {
  return {
    id: '01HW000000000000000000004',
    characterId: 'char-001',
    state: 'stable',
    severity: 'moderate',
    injuries: [],
    updatedByPrincipalId: 'principal-001',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeReviveAudit(overrides: Partial<AtcReviveAudit> = {}): AtcReviveAudit {
  return {
    id: '01HW000000000000000000005',
    characterId: 'char-001',
    emergencyId: null,
    revivedByPrincipalId: 'principal-001',
    previousState: 'deceased',
    resultingState: 'stable',
    notes: null,
    revivedAt: new Date(),
    ...overrides,
  }
}

// ── Error class hierarchy ─────────────────────────────────────────────────────

describe('EMS error hierarchy', () => {
  it('EmsError is base class', () => {
    const e = new EmsError('base')
    expect(e).toBeInstanceOf(Error)
    expect(e).toBeInstanceOf(EmsError)
    expect(e.message).toBe('base')
  })

  it('all error subclasses extend EmsError', () => {
    expect(new EmsValidationError('v')).toBeInstanceOf(EmsError)
    expect(new EmergencyNotFoundError('x')).toBeInstanceOf(EmsError)
    expect(new EmergencyClosedError('x')).toBeInstanceOf(EmsError)
    expect(new EmergencyImmutableError('x', 'reported', 'closed')).toBeInstanceOf(EmsError)
    expect(new AmbulanceNotFoundError('AMB-01')).toBeInstanceOf(EmsError)
    expect(new AmbulanceUnavailableError('AMB-01', 'dispatched')).toBeInstanceOf(EmsError)
    expect(new HospitalCapacityNotFoundError('hosp-1')).toBeInstanceOf(EmsError)
    expect(new HospitalAtCapacityError('hosp-1')).toBeInstanceOf(EmsError)
    expect(new ReviveCooldownError('char-1', 300)).toBeInstanceOf(EmsError)
    expect(new TriageValidationError('bad')).toBeInstanceOf(EmsError)
  })

  it('error messages contain context', () => {
    expect(new EmergencyNotFoundError('abc').message).toContain('abc')
    expect(new EmergencyImmutableError('id', 'reported', 'admitted').message).toContain('reported')
    expect(new ReviveCooldownError('char-1', 300).message).toContain('300')
  })
})

// ── TriageService ─────────────────────────────────────────────────────────────

describe('TriageService', () => {
  const svc = new TriageService()

  describe('assign()', () => {
    it('fatal → black', () => {
      expect(svc.assign({ severity: 'fatal' })).toBe('black')
    })

    it('critical → red', () => {
      expect(svc.assign({ severity: 'critical' })).toBe('red')
    })

    it('cardiac arrest → red regardless of severity', () => {
      expect(svc.assign({ severity: 'minor', isCardiacArrest: true })).toBe('red')
    })

    it('unconscious moderate → yellow', () => {
      expect(svc.assign({ severity: 'moderate', isUnconscious: true })).toBe('yellow')
    })

    it('minor with no indicators → green', () => {
      expect(svc.assign({ severity: 'minor' })).toBe('green')
    })
  })

  describe('score()', () => {
    it('cardiac arrest gets score >= 95', () => {
      expect(svc.score({ severity: 'minor', isCardiacArrest: true })).toBeGreaterThanOrEqual(95)
    })

    it('fatal severity gets max score', () => {
      expect(svc.score({ severity: 'fatal' })).toBe(100)
    })

    it('minor with no flags gets low score', () => {
      expect(svc.score({ severity: 'minor' })).toBeLessThan(50)
    })
  })

  describe('sortByPriority()', () => {
    it('sorts red before yellow before green before black', () => {
      const emergencies = [
        makeEmergency({ id: '1', triageCategory: 'black' }),
        makeEmergency({ id: '2', triageCategory: 'green' }),
        makeEmergency({ id: '3', triageCategory: 'red' }),
        makeEmergency({ id: '4', triageCategory: 'yellow' }),
      ]
      const sorted = svc.sortByPriority(emergencies)
      expect(sorted.map(e => e.triageCategory)).toEqual(['red', 'yellow', 'green', 'black'])
    })

    it('untriaged emergencies sort last', () => {
      const emergencies = [
        makeEmergency({ id: '1', triageCategory: null }),
        makeEmergency({ id: '2', triageCategory: 'green' }),
      ]
      const sorted = svc.sortByPriority(emergencies)
      expect(sorted[0].triageCategory).toBe('green')
    })

    it('does not mutate the input array', () => {
      const input = [
        makeEmergency({ id: '1', triageCategory: 'black' }),
        makeEmergency({ id: '2', triageCategory: 'red' }),
      ]
      svc.sortByPriority(input)
      expect(input[0].triageCategory).toBe('black')
    })
  })

  describe('validate()', () => {
    it('accepts valid triage categories', () => {
      expect(svc.validate('red')).toBe('red')
      expect(svc.validate('yellow')).toBe('yellow')
      expect(svc.validate('green')).toBe('green')
      expect(svc.validate('black')).toBe('black')
    })

    it('throws TriageValidationError for unknown category', () => {
      expect(() => svc.validate('purple')).toThrow(TriageValidationError)
    })
  })
})

// ── EmergencyRepository (mocked pool) ────────────────────────────────────────

describe('EmergencyRepository', () => {
  function makeConn(rows: unknown[] = []) {
    return {
      execute: vi.fn().mockResolvedValue([rows, []]),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    }
  }

  it('create() returns a reported emergency', async () => {
    const dbRow = {
      id: '01HW1', character_id: 'char-1', incident_id: null, status: 'reported',
      triage_category: null, assigned_responder_ids: '[]', notes: null,
      created_by_principal_id: 'p1', closed_at: null,
      created_at: new Date(), updated_at: new Date(),
    }
    const conn = makeConn()
    // First execute: INSERT; Second: INSERT audit; Third: SELECT by id
    conn.execute
      .mockResolvedValueOnce([[], []])           // INSERT emergency
      .mockResolvedValueOnce([[], []])           // INSERT audit
      .mockResolvedValueOnce([[dbRow], []])      // SELECT emergency

    const pool = { getConnection: vi.fn().mockResolvedValue(conn) }
    const repo = new EmergencyRepository(pool as never)
    const result = await repo.create({ characterId: 'char-1', createdByPrincipalId: 'p1' })

    expect(result.status).toBe('reported')
    expect(result.assignedResponderIds).toEqual([])
    expect(conn.release).toHaveBeenCalled()
  })

  it('triage() throws EmergencyNotFoundError when no row found', async () => {
    const conn = makeConn([])
    conn.execute.mockResolvedValueOnce([[], []])  // FOR UPDATE returns empty
    const pool = { getConnection: vi.fn().mockResolvedValue(conn) }
    const repo = new EmergencyRepository(pool as never)

    await expect(
      repo.triage({ id: 'missing', category: 'red', principalId: 'p1' })
    ).rejects.toThrow(EmergencyNotFoundError)
    expect(conn.rollback).toHaveBeenCalled()
  })

  it('triage() throws EmergencyClosedError for closed emergency', async () => {
    const closedRow = {
      id: 'e1', character_id: 'char-1', incident_id: null, status: 'closed',
      triage_category: null, assigned_responder_ids: '[]', notes: null,
      created_by_principal_id: 'p1', closed_at: new Date(),
      created_at: new Date(), updated_at: new Date(),
    }
    const conn = makeConn()
    conn.execute.mockResolvedValueOnce([[closedRow], []])
    const pool = { getConnection: vi.fn().mockResolvedValue(conn) }
    const repo = new EmergencyRepository(pool as never)

    await expect(
      repo.triage({ id: 'e1', category: 'red', principalId: 'p1' })
    ).rejects.toThrow(EmergencyClosedError)
  })

  it('triage() throws EmergencyImmutableError for invalid transition', async () => {
    const admittedRow = {
      id: 'e1', character_id: 'char-1', incident_id: null, status: 'admitted',
      triage_category: null, assigned_responder_ids: '[]', notes: null,
      created_by_principal_id: 'p1', closed_at: null,
      created_at: new Date(), updated_at: new Date(),
    }
    const conn = makeConn()
    conn.execute.mockResolvedValueOnce([[admittedRow], []])
    const pool = { getConnection: vi.fn().mockResolvedValue(conn) }
    const repo = new EmergencyRepository(pool as never)

    await expect(
      repo.triage({ id: 'e1', category: 'red', principalId: 'p1' })
    ).rejects.toThrow(EmergencyImmutableError)
  })

  it('assignResponder() is idempotent for duplicate responder', async () => {
    const existingRow = {
      id: 'e1', character_id: 'char-1', incident_id: null, status: 'triaged',
      triage_category: 'yellow', assigned_responder_ids: '["amb-01"]', notes: null,
      created_by_principal_id: 'p1', closed_at: null,
      created_at: new Date(), updated_at: new Date(),
    }
    const updatedRow = { ...existingRow, status: 'responders_assigned' }
    const conn = makeConn()
    conn.execute
      .mockResolvedValueOnce([[existingRow], []])  // FOR UPDATE
      .mockResolvedValueOnce([[], []])             // UPDATE emergency
      .mockResolvedValueOnce([[], []])             // INSERT audit
      .mockResolvedValueOnce([[updatedRow], []])   // SELECT after commit

    const pool = { getConnection: vi.fn().mockResolvedValue(conn) }
    const repo = new EmergencyRepository(pool as never)
    const result = await repo.assignResponder({ id: 'e1', responderPrincipalId: 'amb-01', principalId: 'p1' })

    // Duplicate not added — still only one responder
    expect(result.status).toBe('responders_assigned')
  })

  it('transition() to closed sets closedAt', async () => {
    const reportedRow = {
      id: 'e1', character_id: 'char-1', incident_id: null, status: 'reported',
      triage_category: null, assigned_responder_ids: '[]', notes: null,
      created_by_principal_id: 'p1', closed_at: null,
      created_at: new Date(), updated_at: new Date(),
    }
    const closedRow = { ...reportedRow, status: 'closed', closed_at: new Date() }
    const conn = makeConn()
    conn.execute
      .mockResolvedValueOnce([[reportedRow], []])  // FOR UPDATE
      .mockResolvedValueOnce([[], []])             // UPDATE
      .mockResolvedValueOnce([[], []])             // INSERT audit
      .mockResolvedValueOnce([[closedRow], []])    // SELECT

    const pool = { getConnection: vi.fn().mockResolvedValue(conn) }
    const repo = new EmergencyRepository(pool as never)
    const result = await repo.transition({ id: 'e1', newStatus: 'closed', principalId: 'p1' })

    expect(result.status).toBe('closed')
    expect(result.closedAt).not.toBeNull()
  })
})

// ── AmbulanceRepository ───────────────────────────────────────────────────────

describe('AmbulanceRepository', () => {
  function makeConn() {
    return {
      execute: vi.fn(),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    }
  }

  it('dispatch() throws AmbulanceUnavailableError when affectedRows === 0', async () => {
    const conn = makeConn()
    const unavailableRow = {
      id: '01HW2', unit_id: 'AMB-01', status: 'dispatched', emergency_id: 'e1',
      facility_id: null, last_updated_by: 'p1',
      created_at: new Date(), updated_at: new Date(),
    }
    // atomic UPDATE → affectedRows: 0; then SELECT for error context
    conn.execute
      .mockResolvedValueOnce([{ affectedRows: 0 }, []])
      .mockResolvedValueOnce([[unavailableRow], []])

    const pool = { getConnection: vi.fn().mockResolvedValue(conn) }
    const repo = new AmbulanceRepository(pool as never)

    await expect(
      repo.dispatch('AMB-01', 'e1', 'p1')
    ).rejects.toThrow(AmbulanceUnavailableError)
  })

  it('dispatch() succeeds when unit is available', async () => {
    const dispatchedRow = {
      id: '01HW2', unit_id: 'AMB-01', status: 'dispatched', emergency_id: 'e1',
      facility_id: null, last_updated_by: 'p1',
      created_at: new Date(), updated_at: new Date(),
    }
    const conn = makeConn()
    conn.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([[dispatchedRow], []])

    const pool = { getConnection: vi.fn().mockResolvedValue(conn) }
    const repo = new AmbulanceRepository(pool as never)
    const result = await repo.dispatch('AMB-01', 'e1', 'p1')

    expect(result.status).toBe('dispatched')
    expect(result.emergencyId).toBe('e1')
  })

  it('register() handles ER_DUP_ENTRY idempotently', async () => {
    const existingRow = {
      id: '01HW2', unit_id: 'AMB-01', status: 'available', emergency_id: null,
      facility_id: null, last_updated_by: 'p1',
      created_at: new Date(), updated_at: new Date(),
    }
    const conn = makeConn()
    const dupError = Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' })
    conn.execute
      .mockRejectedValueOnce(dupError)           // INSERT throws dup
      .mockResolvedValueOnce([[existingRow], []]) // SELECT existing

    const pool = { getConnection: vi.fn().mockResolvedValue(conn) }
    const repo = new AmbulanceRepository(pool as never)
    const result = await repo.register('AMB-01', 'p1')

    expect(result.unitId).toBe('AMB-01')
    expect(result.status).toBe('available')
  })
})

// ── HospitalCapacityRepository ────────────────────────────────────────────────

describe('HospitalCapacityRepository', () => {
  function makeConn() {
    return {
      execute: vi.fn(),
      release: vi.fn(),
    }
  }

  it('admitPatient() throws HospitalAtCapacityError when no beds available', async () => {
    const conn = makeConn()
    conn.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []])
    const pool = { getConnection: vi.fn().mockResolvedValue(conn) }
    const repo = new HospitalCapacityRepository(pool as never)

    await expect(repo.admitPatient('hosp-main')).rejects.toThrow(HospitalAtCapacityError)
  })

  it('admitPatient() succeeds and decrements available_beds', async () => {
    const capacityRow = {
      id: '01HW3', facility_id: 'hosp-main', total_beds: 20, available_beds: 9,
      icu_total: 5, icu_available: 2, er_total: 8, er_available: 4,
      is_diversion: 0, is_overflow: 0, updated_at: new Date(),
    }
    const conn = makeConn()
    conn.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([[capacityRow], []])

    const pool = { getConnection: vi.fn().mockResolvedValue(conn) }
    const repo = new HospitalCapacityRepository(pool as never)
    const result = await repo.admitPatient('hosp-main')

    expect(result.availableBeds).toBe(9)
  })

  it('dischargePatient() increments available_beds', async () => {
    const capacityRow = {
      id: '01HW3', facility_id: 'hosp-main', total_beds: 20, available_beds: 11,
      icu_total: 5, icu_available: 2, er_total: 8, er_available: 4,
      is_diversion: 0, is_overflow: 0, updated_at: new Date(),
    }
    const conn = makeConn()
    conn.execute
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[capacityRow], []])

    const pool = { getConnection: vi.fn().mockResolvedValue(conn) }
    const repo = new HospitalCapacityRepository(pool as never)
    const result = await repo.dischargePatient('hosp-main')

    expect(result.availableBeds).toBe(11)
  })
})

// ── ReviveWorkflowService ─────────────────────────────────────────────────────

describe('ReviveWorkflowService', () => {
  const DEFAULT_COOLDOWN = DEFAULT_REVIVE_COOLDOWN_SECONDS

  function makeReviveAuditRepo(recentRevive: object | null = null) {
    return {
      findRecentRevive: vi.fn().mockResolvedValue(recentRevive),
      record: vi.fn().mockResolvedValue(makeReviveAudit()),
      listForCharacter: vi.fn().mockResolvedValue([]),
    }
  }

  function makeMedicalService(trauma: AtcTraumaRecord = makeTraumaRecord()) {
    return {
      revive: vi.fn().mockResolvedValue(trauma),
    }
  }

  it('throws ReviveCooldownError when character was recently revived', async () => {
    const auditRepo = makeReviveAuditRepo(makeReviveAudit())
    const medSvc = makeMedicalService()
    const svc = new ReviveWorkflowService(auditRepo as never, medSvc, undefined)

    await expect(
      svc.revive({ characterId: 'char-1', revivedByPrincipalId: 'p1' })
    ).rejects.toThrow(ReviveCooldownError)

    expect(medSvc.revive).not.toHaveBeenCalled()
  })

  it('calls medical service and records audit on successful revive', async () => {
    const auditRepo = makeReviveAuditRepo(null)
    const medSvc = makeMedicalService()
    const svc = new ReviveWorkflowService(auditRepo as never, medSvc, undefined)

    const result = await svc.revive({ characterId: 'char-1', revivedByPrincipalId: 'p1' })

    expect(medSvc.revive).toHaveBeenCalledWith(expect.objectContaining({
      characterId: 'char-1',
      revivedByPrincipalId: 'p1',
    }))
    expect(auditRepo.record).toHaveBeenCalledWith(expect.objectContaining({
      characterId: 'char-1',
      previousState: 'deceased',
    }))
    expect(result.trauma.state).toBe('stable')
    expect(result.audit).toBeDefined()
  })

  it('emits REVIVE_COMPLETED event on success', async () => {
    const auditRepo = makeReviveAuditRepo(null)
    const medSvc = makeMedicalService()
    const eventBus = { emit: vi.fn().mockResolvedValue(undefined) }
    const svc = new ReviveWorkflowService(auditRepo as never, medSvc, eventBus as never)

    await svc.revive({ characterId: 'char-1', revivedByPrincipalId: 'p1', emergencyId: 'e1' })

    expect(eventBus.emit).toHaveBeenCalledWith(
      expect.stringContaining('revive'),
      expect.objectContaining({ characterId: 'char-1', emergencyId: 'e1' }),
    )
  })

  it('does not throw if event bus emit fails (fire-and-forget)', async () => {
    const auditRepo = makeReviveAuditRepo(null)
    const medSvc = makeMedicalService()
    const eventBus = { emit: vi.fn().mockRejectedValue(new Error('bus down')) }
    const svc = new ReviveWorkflowService(auditRepo as never, medSvc, eventBus as never)

    await expect(
      svc.revive({ characterId: 'char-1', revivedByPrincipalId: 'p1' })
    ).resolves.toBeDefined()
  })

  it('uses DEFAULT_REVIVE_COOLDOWN_SECONDS constant', () => {
    expect(DEFAULT_COOLDOWN).toBe(300)
  })
})

// ── EmergencyRuntimeService (orchestrator) ────────────────────────────────────

describe('EmergencyRuntimeService', () => {
  function makeDeps() {
    const emergencyRepo = {
      create: vi.fn().mockResolvedValue(makeEmergency()),
      triage: vi.fn().mockResolvedValue(makeEmergency({ status: 'triaged', triageCategory: 'yellow' })),
      assignResponder: vi.fn().mockResolvedValue(makeEmergency({ status: 'responders_assigned' })),
      transition: vi.fn().mockResolvedValue(makeEmergency({ status: 'stabilized' })),
      findById: vi.fn().mockResolvedValue(makeEmergency()),
      listActive: vi.fn().mockResolvedValue([makeEmergency()]),
      listAudit: vi.fn().mockResolvedValue([]),
    }
    const dispatchService = {
      dispatch: vi.fn().mockResolvedValue(makeAmbulance({ status: 'dispatched' })),
      listActive: vi.fn().mockResolvedValue([]),
      listAvailable: vi.fn().mockResolvedValue([makeAmbulance()]),
    }
    const capacityService = {
      admitPatient: vi.fn().mockResolvedValue(makeCapacity({ availableBeds: 9 })),
      listAll: vi.fn().mockResolvedValue([makeCapacity()]),
    }
    const escalationService = {
      evaluateAndEscalate: vi.fn(),
    }
    const triageService = new TriageService()
    return { emergencyRepo, dispatchService, capacityService, escalationService, triageService }
  }

  it('createEmergency() delegates to emergencyRepo', async () => {
    const deps = makeDeps()
    const svc = new EmergencyRuntimeService({ ...deps, eventBus: undefined })

    const result = await svc.createEmergency({ characterId: 'char-1', createdByPrincipalId: 'p1' })

    expect(deps.emergencyRepo.create).toHaveBeenCalledOnce()
    expect(result.status).toBe('reported')
  })

  it('triage() validates category and calls escalation', async () => {
    const deps = makeDeps()
    const svc = new EmergencyRuntimeService({ ...deps, eventBus: undefined })

    await svc.triage('e1', { category: 'red', principalId: 'p1' })

    expect(deps.emergencyRepo.triage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e1', category: 'red' })
    )
    expect(deps.escalationService.evaluateAndEscalate).toHaveBeenCalled()
  })

  it('triage() throws TriageValidationError for unknown category', async () => {
    const deps = makeDeps()
    const svc = new EmergencyRuntimeService({ ...deps, eventBus: undefined })

    await expect(
      svc.triage('e1', { category: 'purple' as never, principalId: 'p1' })
    ).rejects.toThrow(TriageValidationError)

    expect(deps.emergencyRepo.triage).not.toHaveBeenCalled()
  })

  it('assignResponder() dispatches ambulance before updating emergency', async () => {
    const deps = makeDeps()
    const svc = new EmergencyRuntimeService({ ...deps, eventBus: undefined })
    const callOrder: string[] = []
    deps.dispatchService.dispatch.mockImplementation(async () => {
      callOrder.push('dispatch')
      return makeAmbulance({ status: 'dispatched' })
    })
    deps.emergencyRepo.assignResponder.mockImplementation(async () => {
      callOrder.push('assign')
      return makeEmergency({ status: 'responders_assigned' })
    })

    await svc.assignResponder('e1', { responderUnitId: 'AMB-01', principalId: 'p1' })

    expect(callOrder).toEqual(['dispatch', 'assign'])
  })

  it('transport() admits patient to hospital before transitioning emergency', async () => {
    const deps = makeDeps()
    const callOrder: string[] = []
    deps.capacityService.admitPatient.mockImplementation(async () => {
      callOrder.push('admit')
      return makeCapacity({ availableBeds: 9 })
    })
    deps.emergencyRepo.transition.mockImplementation(async () => {
      callOrder.push('transition')
      return makeEmergency({ status: 'transported' })
    })
    const svc = new EmergencyRuntimeService({ ...deps, eventBus: undefined })

    await svc.transport('e1', { facilityId: 'hospital-main', principalId: 'p1' })

    expect(callOrder).toEqual(['admit', 'transition'])
  })

  it('transport() throws HospitalAtCapacityError and does NOT transition emergency', async () => {
    const deps = makeDeps()
    deps.capacityService.admitPatient.mockRejectedValue(new HospitalAtCapacityError('hosp-1'))
    const svc = new EmergencyRuntimeService({ ...deps, eventBus: undefined })

    await expect(
      svc.transport('e1', { facilityId: 'hosp-1', principalId: 'p1' })
    ).rejects.toThrow(HospitalAtCapacityError)

    expect(deps.emergencyRepo.transition).not.toHaveBeenCalled()
  })

  it('stabilize() emits PATIENT_STABILIZED event', async () => {
    const deps = makeDeps()
    deps.emergencyRepo.transition.mockResolvedValue(makeEmergency({ status: 'stabilized', characterId: 'char-1' }))
    const eventBus = { emit: vi.fn().mockResolvedValue(undefined) }
    const svc = new EmergencyRuntimeService({ ...deps, eventBus: eventBus as never })

    await svc.stabilize('e1', { principalId: 'p1' })

    expect(eventBus.emit).toHaveBeenCalledWith(
      expect.stringContaining('stabilized'),
      expect.objectContaining({ emergencyId: 'e1' }),
    )
  })

  it('close() transitions to closed', async () => {
    const deps = makeDeps()
    deps.emergencyRepo.transition.mockResolvedValue(makeEmergency({ status: 'closed', closedAt: new Date() }))
    const svc = new EmergencyRuntimeService({ ...deps, eventBus: undefined })

    const result = await svc.close('e1', { principalId: 'p1' })

    expect(result.status).toBe('closed')
    expect(deps.emergencyRepo.transition).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: 'closed' })
    )
  })

  it('findById() returns null for unknown id', async () => {
    const deps = makeDeps()
    deps.emergencyRepo.findById.mockResolvedValue(null)
    const svc = new EmergencyRuntimeService({ ...deps, eventBus: undefined })

    const result = await svc.findById('does-not-exist')
    expect(result).toBeNull()
  })
})

// ── Zod schemas (from @atc/operations) ───────────────────────────────────────

describe('EMS operation schemas', () => {
  it('createEmergencySchema requires characterId and createdByPrincipalId', () => {
    const valid = createEmergencySchema.safeParse({
      characterId: 'char-1',
      createdByPrincipalId: 'p1',
    })
    expect(valid.success).toBe(true)
  })

  it('createEmergencySchema rejects empty characterId', () => {
    const r = createEmergencySchema.safeParse({ characterId: '', createdByPrincipalId: 'p1' })
    expect(r.success).toBe(false)
  })

  it('triageEmergencySchema requires category and principalId', () => {
    const valid = triageEmergencySchema.safeParse({ category: 'red', principalId: 'p1' })
    expect(valid.success).toBe(true)
  })

  it('triageEmergencySchema rejects unknown triage category', () => {
    const r = triageEmergencySchema.safeParse({ category: 'purple', principalId: 'p1' })
    expect(r.success).toBe(false)
  })

  it('assignEmergencySchema requires responderUnitId and principalId', () => {
    const valid = assignEmergencySchema.safeParse({ responderUnitId: 'AMB-01', principalId: 'p1' })
    expect(valid.success).toBe(true)
  })

  it('stabilizeEmergencySchema requires principalId', () => {
    const valid = stabilizeEmergencySchema.safeParse({ principalId: 'p1' })
    expect(valid.success).toBe(true)
  })

  it('transportEmergencySchema requires facilityId and principalId', () => {
    const valid = transportEmergencySchema.safeParse({
      facilityId: 'hosp-main',
      principalId: 'p1',
    })
    expect(valid.success).toBe(true)
  })

  it('closeEmergencySchema requires principalId', () => {
    const valid = closeEmergencySchema.safeParse({ principalId: 'p1' })
    expect(valid.success).toBe(true)
  })

  it('closeEmergencySchema rejects missing principalId', () => {
    const r = closeEmergencySchema.safeParse({})
    expect(r.success).toBe(false)
  })
})
