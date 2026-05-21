import { describe, it, expect, vi } from 'vitest'
import type { PoolConnection } from 'mysql2/promise'
import {
  InjuryRepository,
  TraumaRepository,
  TreatmentRepository,
  MedicalReportRepository,
  HospitalRepository,
  MedicalService,
  InjuryNotFoundError,
  TraumaNotFoundError,
  TraumaImmutableError,
  PatientDeceasedError,
  PatientAlreadyAliveError,
  MedicalReportClosedError,
  HospitalAlreadyAdmittedError,
  HospitalImmutableError,
} from '@atc/medical'
import type { MedicalPool } from '@atc/medical'
import type { AtcEventBus } from '@atc/events'
import { ATC_MEDICAL_EVENTS } from '@atc/shared-types'

// ── Mock helpers ───────────────────────────────────────────────────────────────

function makeConn(): PoolConnection {
  return {
    execute:          vi.fn().mockResolvedValue([[]]),
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit:           vi.fn().mockResolvedValue(undefined),
    rollback:         vi.fn().mockResolvedValue(undefined),
    release:          vi.fn(),
  } as unknown as PoolConnection
}

function makePool(conn: PoolConnection): MedicalPool {
  return { getConnection: vi.fn().mockResolvedValue(conn) }
}

function makeEventBus(): AtcEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined), on: vi.fn(), off: vi.fn() } as unknown as AtcEventBus
}

// ── Fixture rows ───────────────────────────────────────────────────────────────

function injuryRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inj-1', character_id: 'char-1', agency_id: null, incident_id: null,
    recorded_by_principal_id: 'prin-1', region: 'chest', severity: 'moderate',
    description: 'Gunshot wound to chest',
    metadata: '{}',
    created_at: new Date('2025-01-01'), updated_at: new Date('2025-01-01'),
    ...overrides,
  }
}

function traumaRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'trauma-1', character_id: 'char-1', state: 'stable', previous_state: null,
    updated_by_principal_id: 'prin-1', notes: null,
    state_changed_at: new Date('2025-01-01'),
    created_at: new Date('2025-01-01'), updated_at: new Date('2025-01-01'),
    ...overrides,
  }
}

function treatmentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'treat-1', character_id: 'char-1', applied_by_principal_id: 'prin-1',
    incident_id: null, type: 'bandage', item_id: null, notes: null,
    previous_trauma: null, resulting_trauma: null,
    metadata: '{}',
    applied_at: new Date('2025-01-01'),
    ...overrides,
  }
}

function reportRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'report-1', character_id: 'char-1', created_by_principal_id: 'prin-1',
    incident_id: null, arrest_id: null,
    diagnosis: 'Trauma from MVA',
    notes: '',
    injury_ids: '[]', treatment_ids: '[]',
    vitals_snapshot: null, closed_at: null, closed_by_principal_id: null,
    created_at: new Date('2025-01-01'), updated_at: new Date('2025-01-01'),
    ...overrides,
  }
}

function hospitalRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'hosp-1', character_id: 'char-1', admitted_by_principal_id: 'prin-1',
    status: 'admitted', facility_id: null, incident_id: null, notes: null,
    admitted_at: new Date('2025-01-01'),
    status_changed_at: new Date('2025-01-01'),
    discharged_at: null, updated_at: new Date('2025-01-01'),
    ...overrides,
  }
}

// ── InjuryRepository ──────────────────────────────────────────────────────────

describe('InjuryRepository', () => {
  it('record() inserts and returns the injury', async () => {
    const conn = makeConn()
    const row = injuryRow()
    vi.mocked(conn.execute)
      .mockResolvedValueOnce([undefined]) // INSERT
      .mockResolvedValueOnce([[row]])     // SELECT
    const repo = new InjuryRepository(makePool(conn))
    const result = await repo.record({
      characterId: 'char-1', recordedByPrincipalId: 'prin-1',
      region: 'chest', severity: 'moderate', description: 'Gunshot wound',
    })
    expect(result.id).toBe('inj-1')
    expect(result.region).toBe('chest')
  })

  it('findById() returns null for unknown id', async () => {
    const conn = makeConn()
    vi.mocked(conn.execute).mockResolvedValueOnce([[]])
    const repo = new InjuryRepository(makePool(conn))
    const result = await repo.findById('nope')
    expect(result).toBeNull()
  })
})

// ── TraumaRepository ──────────────────────────────────────────────────────────

describe('TraumaRepository', () => {
  it('getOrCreate() returns existing record when present', async () => {
    const conn = makeConn()
    const row = traumaRow()
    vi.mocked(conn.execute).mockResolvedValueOnce([[row]])
    const repo = new TraumaRepository(makePool(conn))
    const result = await repo.getOrCreate('char-1', 'prin-1')
    expect(result.state).toBe('stable')
  })

  it('getOrCreate() creates new record when none exists', async () => {
    const conn = makeConn()
    const row = traumaRow()
    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[]])        // SELECT (not found)
      .mockResolvedValueOnce([undefined]) // INSERT
      .mockResolvedValueOnce([[row]])     // SELECT after insert
    const repo = new TraumaRepository(makePool(conn))
    const result = await repo.getOrCreate('char-1', 'prin-1')
    expect(result.characterId).toBe('char-1')
  })

  it('transition() follows ALLOWED_TRANSITIONS', async () => {
    const conn = makeConn()
    const currentRow = traumaRow({ state: 'stable' })
    const updatedRow = traumaRow({ state: 'bleeding', previous_state: 'stable' })
    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[currentRow]]) // FOR UPDATE SELECT
      .mockResolvedValueOnce([undefined])    // UPDATE
      .mockResolvedValueOnce([[updatedRow]]) // SELECT after
    const repo = new TraumaRepository(makePool(conn))
    const result = await repo.transition({
      characterId: 'char-1', newState: 'bleeding', updatedByPrincipalId: 'prin-1',
    })
    expect(result.state).toBe('bleeding')
    expect(result.previousState).toBe('stable')
  })

  it('transition() throws TraumaImmutableError for invalid transition', async () => {
    const conn = makeConn()
    // cardiac_arrest cannot go to bleeding
    const currentRow = traumaRow({ state: 'cardiac_arrest' })
    vi.mocked(conn.execute).mockResolvedValueOnce([[currentRow]])
    const repo = new TraumaRepository(makePool(conn))
    await expect(
      repo.transition({ characterId: 'char-1', newState: 'bleeding', updatedByPrincipalId: 'prin-1' })
    ).rejects.toThrow(TraumaImmutableError)
    expect(conn.rollback).toHaveBeenCalled()
  })

  it('findByCharacter() returns null when no record exists', async () => {
    const conn = makeConn()
    vi.mocked(conn.execute).mockResolvedValueOnce([[]])
    const repo = new TraumaRepository(makePool(conn))
    const result = await repo.findByCharacter('nobody')
    expect(result).toBeNull()
  })
})

// ── TreatmentRepository ───────────────────────────────────────────────────────

describe('TreatmentRepository', () => {
  it('apply() inserts and returns treatment record', async () => {
    const conn = makeConn()
    const row = treatmentRow()
    vi.mocked(conn.execute)
      .mockResolvedValueOnce([undefined])   // INSERT
      .mockResolvedValueOnce([[row]])       // SELECT
    const repo = new TreatmentRepository(makePool(conn))
    const result = await repo.apply({
      characterId: 'char-1', appliedByPrincipalId: 'prin-1', type: 'bandage',
    })
    expect(result.type).toBe('bandage')
    expect(result.appliedAt).toBeInstanceOf(Date)
  })

  it('listByCharacter() returns empty array when none exist', async () => {
    const conn = makeConn()
    vi.mocked(conn.execute).mockResolvedValueOnce([[]])
    const repo = new TreatmentRepository(makePool(conn))
    const results = await repo.listByCharacter('char-1')
    expect(results).toEqual([])
  })
})

// ── MedicalReportRepository ───────────────────────────────────────────────────

describe('MedicalReportRepository', () => {
  it('create() inserts and returns report', async () => {
    const conn = makeConn()
    const row = reportRow()
    vi.mocked(conn.execute)
      .mockResolvedValueOnce([undefined]) // INSERT
      .mockResolvedValueOnce([[row]])     // SELECT
    const repo = new MedicalReportRepository(makePool(conn))
    const result = await repo.create({
      characterId: 'char-1', createdByPrincipalId: 'prin-1', diagnosis: 'Trauma from MVA',
    })
    expect(result.diagnosis).toBe('Trauma from MVA')
    expect(result.closedAt).toBeNull()
  })

  it('close() marks report as closed', async () => {
    const conn = makeConn()
    const openRow = reportRow()
    const closedRow = reportRow({ closed_at: new Date(), closed_by_principal_id: 'prin-1' })
    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[openRow]])   // findById (pre-check)
      .mockResolvedValueOnce([undefined])  // UPDATE
      .mockResolvedValueOnce([[closedRow]]) // findById (return)
    const repo = new MedicalReportRepository(makePool(conn))
    const result = await repo.close('report-1', 'prin-1')
    expect(result.closedAt).not.toBeNull()
    expect(result.closedByPrincipalId).toBe('prin-1')
  })

  it('close() throws MedicalReportClosedError if already closed', async () => {
    const conn = makeConn()
    const closedRow = reportRow({ closed_at: new Date(), closed_by_principal_id: 'prin-1' })
    vi.mocked(conn.execute).mockResolvedValueOnce([[closedRow]])
    const repo = new MedicalReportRepository(makePool(conn))
    await expect(repo.close('report-1', 'prin-2')).rejects.toThrow(MedicalReportClosedError)
  })
})

// ── HospitalRepository ────────────────────────────────────────────────────────

describe('HospitalRepository', () => {
  it('admit() creates a new record', async () => {
    const conn = makeConn()
    const row = hospitalRow()
    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[]])        // findActiveForCharacter (none)
      .mockResolvedValueOnce([undefined]) // INSERT
      .mockResolvedValueOnce([[row]])     // findById
    const repo = new HospitalRepository(makePool(conn))
    const result = await repo.admit({
      characterId: 'char-1', admittedByPrincipalId: 'prin-1',
    })
    expect(result.status).toBe('admitted')
  })

  it('admit() throws HospitalAlreadyAdmittedError if active record exists', async () => {
    const conn = makeConn()
    const existing = hospitalRow({ status: 'icu' })
    vi.mocked(conn.execute).mockResolvedValueOnce([[existing]])
    const repo = new HospitalRepository(makePool(conn))
    await expect(
      repo.admit({ characterId: 'char-1', admittedByPrincipalId: 'prin-1' })
    ).rejects.toThrow(HospitalAlreadyAdmittedError)
  })

  it('updateStatus() transitions admitted → discharged', async () => {
    const conn = makeConn()
    const current = hospitalRow({ status: 'admitted' })
    const updated = hospitalRow({ status: 'discharged', discharged_at: new Date() })
    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[current]])  // FOR UPDATE SELECT
      .mockResolvedValueOnce([undefined]) // UPDATE
      .mockResolvedValueOnce([[updated]]) // findById
    const repo = new HospitalRepository(makePool(conn))
    const result = await repo.updateStatus({
      id: 'hosp-1', newStatus: 'discharged', updatedByPrincipalId: 'prin-1',
    })
    expect(result.status).toBe('discharged')
  })

  it('updateStatus() throws HospitalImmutableError from discharged', async () => {
    const conn = makeConn()
    const current = hospitalRow({ status: 'discharged' })
    vi.mocked(conn.execute).mockResolvedValueOnce([[current]])
    const repo = new HospitalRepository(makePool(conn))
    await expect(
      repo.updateStatus({ id: 'hosp-1', newStatus: 'icu', updatedByPrincipalId: 'prin-1' })
    ).rejects.toThrow(HospitalImmutableError)
  })
})

// ── MedicalService ────────────────────────────────────────────────────────────

describe('MedicalService', () => {
  function makeDeps() {
    const conn = makeConn()
    const pool = makePool(conn)
    const injuryRepo    = new InjuryRepository(pool)
    const traumaRepo    = new TraumaRepository(pool)
    const treatmentRepo = new TreatmentRepository(pool)
    const reportRepo    = new MedicalReportRepository(pool)
    const hospitalRepo  = new HospitalRepository(pool)
    const eventBus      = makeEventBus()
    const service = new MedicalService({
      injuryRepo, traumaRepo, treatmentRepo, reportRepo, hospitalRepo,
      eventBus, vitalsBridge: undefined,
    })
    return { conn, pool, service, eventBus }
  }

  it('revive() transitions deceased → stable and emits PLAYER_REVIVED', async () => {
    const { conn, service, eventBus } = makeDeps()
    const deceasedRow = traumaRow({ state: 'deceased' })
    const stableRow   = traumaRow({ state: 'stable', previous_state: 'deceased' })
    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[deceasedRow]]) // findByCharacter check
      .mockResolvedValueOnce([[deceasedRow]]) // FOR UPDATE inside transition
      .mockResolvedValueOnce([undefined])    // UPDATE
      .mockResolvedValueOnce([[stableRow]])  // findByCharacter after
    const result = await service.revive({
      characterId: 'char-1',
      revivedByPrincipalId: 'prin-1',
    })
    expect(result.state).toBe('stable')
    expect(eventBus.emit).toHaveBeenCalledWith(
      ATC_MEDICAL_EVENTS.PLAYER_REVIVED,
      expect.objectContaining({ characterId: 'char-1' }),
    )
  })

  it('revive() throws PatientAlreadyAliveError when not deceased', async () => {
    const { conn, service } = makeDeps()
    const stableRow = traumaRow({ state: 'stable' })
    vi.mocked(conn.execute).mockResolvedValueOnce([[stableRow]])
    await expect(
      service.revive({ characterId: 'char-1', revivedByPrincipalId: 'prin-1' })
    ).rejects.toThrow(PatientAlreadyAliveError)
  })

  it('revive() throws TraumaNotFoundError when no trauma record', async () => {
    const { conn, service } = makeDeps()
    vi.mocked(conn.execute).mockResolvedValueOnce([[]])
    await expect(
      service.revive({ characterId: 'char-1', revivedByPrincipalId: 'prin-1' })
    ).rejects.toThrow(TraumaNotFoundError)
  })

  it('updateTrauma() emits PATIENT_DECEASED when transitioning to deceased', async () => {
    const { conn, service, eventBus } = makeDeps()
    const currentRow = traumaRow({ state: 'cardiac_arrest' })
    const updatedRow = traumaRow({ state: 'deceased', previous_state: 'cardiac_arrest' })
    vi.mocked(conn.execute)
      .mockResolvedValueOnce([[currentRow]]) // FOR UPDATE
      .mockResolvedValueOnce([undefined])   // UPDATE
      .mockResolvedValueOnce([[updatedRow]]) // SELECT after
    await service.updateTrauma('char-1', 'deceased', 'prin-1')
    expect(eventBus.emit).toHaveBeenCalledWith(
      ATC_MEDICAL_EVENTS.PATIENT_DECEASED,
      expect.objectContaining({ characterId: 'char-1' }),
    )
  })

  it('recordInjury() emits INJURY_RECORDED', async () => {
    const { conn, service, eventBus } = makeDeps()
    const row = injuryRow()
    vi.mocked(conn.execute)
      .mockResolvedValueOnce([undefined]) // INSERT
      .mockResolvedValueOnce([[row]])     // SELECT
    await service.recordInjury({
      characterId: 'char-1', recordedByPrincipalId: 'prin-1',
      region: 'chest', severity: 'moderate', description: 'Wound',
    })
    expect(eventBus.emit).toHaveBeenCalledWith(
      ATC_MEDICAL_EVENTS.INJURY_RECORDED,
      expect.objectContaining({ injury: expect.any(Object) }),
    )
  })
})

// ── Zod schema smoke tests ────────────────────────────────────────────────────

describe('Medical Zod schemas', () => {
  it('recordInjurySchema validates correctly', async () => {
    const { recordInjurySchema } = await import('@atc/operations')
    const result = recordInjurySchema.safeParse({
      characterId: 'char-1', recordedByPrincipalId: 'prin-1',
      region: 'chest', severity: 'critical', description: 'GSW',
    })
    expect(result.success).toBe(true)
  })

  it('updateTraumaSchema rejects invalid state', async () => {
    const { updateTraumaSchema } = await import('@atc/operations')
    const result = updateTraumaSchema.safeParse({
      newState: 'flying', updatedByPrincipalId: 'prin-1',
    })
    expect(result.success).toBe(false)
  })

  it('revivePatientSchema validates correctly', async () => {
    const { revivePatientSchema } = await import('@atc/operations')
    const result = revivePatientSchema.safeParse({
      revivedByPrincipalId: 'prin-1',
    })
    expect(result.success).toBe(true)
  })
})
