import { describe, it, expect } from 'vitest'
import {
  AtcMedicalIntelligenceSDK,
  MedicalTimelineService,
  TraumaAnalyticsService,
  InvestigationCorrelationService,
  MedicalRiskService,
  MEDICAL_INTEL_LIMITS,
  MEDICAL_SEVERITY_WEIGHTS,
  encodeCursor,
  decodeCursor,
  nextCursor,
  type MedicalReadRepositories,
} from '@atc/medical-intelligence'
import {
  medicalIntelTimelineQuerySchema,
  medicalIntelWindowQuerySchema,
  medicalIntelCharacterParamSchema,
  medicalIntelIncidentParamSchema,
} from '@atc/schemas'
import type {
  AtcInjuryRecord,
  AtcTraumaRecord,
  AtcTreatmentRecord,
  AtcMedicalReport,
  AtcHospitalRecord,
} from '@atc/shared-types'

// ── Fixtures ─────────────────────────────────────────────────────────────────

function injury(over: Partial<AtcInjuryRecord> = {}): AtcInjuryRecord {
  return {
    id: 'i-1', characterId: 'c-1', agencyId: null, incidentId: null,
    recordedByPrincipalId: 'p-1', region: 'head', severity: 'minor',
    description: 'cut', metadata: {},
    createdAt: new Date('2026-01-05'), updatedAt: new Date('2026-01-05'),
    ...over,
  }
}
function trauma(over: Partial<AtcTraumaRecord> = {}): AtcTraumaRecord {
  return {
    id: 't-1', characterId: 'c-1', state: 'stable', previousState: null,
    updatedByPrincipalId: 'p-1', notes: null,
    stateChangedAt: new Date('2026-01-04'),
    createdAt: new Date('2026-01-04'), updatedAt: new Date('2026-01-04'),
    ...over,
  }
}
function treatment(over: Partial<AtcTreatmentRecord> = {}): AtcTreatmentRecord {
  return {
    id: 'tr-1', characterId: 'c-1', appliedByPrincipalId: 'p-1', incidentId: null,
    type: 'bandage', itemId: null, notes: null,
    previousTrauma: null, resultingTrauma: 'stable', metadata: {},
    appliedAt: new Date('2026-01-06'),
    ...over,
  }
}
function report(over: Partial<AtcMedicalReport> = {}): AtcMedicalReport {
  return {
    id: 'r-1', characterId: 'c-1', createdByPrincipalId: 'p-1',
    incidentId: null, arrestId: null,
    diagnosis: 'minor', notes: '', injuryIds: [], treatmentIds: [],
    vitalsSnapshot: null, closedAt: null, closedByPrincipalId: null,
    createdAt: new Date('2026-01-07'), updatedAt: new Date('2026-01-07'),
    ...over,
  }
}
function hospital(over: Partial<AtcHospitalRecord> = {}): AtcHospitalRecord {
  return {
    id: 'h-1', characterId: 'c-1', admittedByPrincipalId: 'p-1',
    status: 'admitted', facilityId: null, incidentId: null, notes: null,
    admittedAt: new Date('2026-01-08'),
    statusChangedAt: new Date('2026-01-08'),
    dischargedAt: null,
    updatedAt: new Date('2026-01-08'),
    ...over,
  }
}

function makeRepos(over: Partial<{
  injuries: AtcInjuryRecord[]; trauma: AtcTraumaRecord[];
  treatments: AtcTreatmentRecord[]; reports: AtcMedicalReport[]; hospital: AtcHospitalRecord[];
}> = {}): MedicalReadRepositories {
  const injuries = over.injuries ?? []
  const traumaList = over.trauma ?? []
  const treatments = over.treatments ?? []
  const reports = over.reports ?? []
  const hospital = over.hospital ?? []
  return {
    injuries: {
      listByCharacter: async (id: string) => injuries.filter((i) => i.characterId === id),
      listByIncident: async (id: string) => injuries.filter((i) => i.incidentId === id),
    },
    trauma: {
      listByCharacter: async (id: string) => traumaList.filter((t) => t.characterId === id),
    },
    treatments: {
      listByCharacter: async (id: string) => treatments.filter((t) => t.characterId === id),
      listByResponder: async (id: string) => treatments.filter((t) => t.appliedByPrincipalId === id),
      listByIncident: async (id: string) => treatments.filter((t) => t.incidentId === id),
    },
    reports: {
      listByCharacter: async (id: string) => reports.filter((r) => r.characterId === id),
      listByIncident: async (id: string) => reports.filter((r) => r.incidentId === id),
    },
    hospital: {
      listByCharacter: async (id: string) => hospital.filter((h) => h.characterId === id),
    },
  }
}

// ── Cursor ───────────────────────────────────────────────────────────────────

describe('medical-intelligence cursor', () => {
  it('round-trips', () => {
    expect(decodeCursor(encodeCursor(13))).toBe(13)
  })
  it('rejects garbage', () => {
    expect(decodeCursor('xx')).toBe(0)
    expect(decodeCursor(null)).toBe(0)
    expect(decodeCursor(Buffer.from('{"offset":-1}').toString('base64url'))).toBe(0)
  })
  it('nextCursor', () => {
    expect(nextCursor(10, 5, 20)).not.toBeNull()
    expect(nextCursor(15, 5, 20)).toBeNull()
  })
})

// ── Timeline ─────────────────────────────────────────────────────────────────

describe('MedicalTimelineService', () => {
  it('empty character id returns empty page', async () => {
    const svc = new MedicalTimelineService({ repos: makeRepos() })
    const p = await svc.getTimeline('')
    expect(p.entries).toEqual([])
  })

  it('aggregates entries from all sources in chronological order', async () => {
    const svc = new MedicalTimelineService({
      repos: makeRepos({
        injuries: [injury()],
        trauma: [trauma()],
        treatments: [treatment()],
        reports: [report()],
        hospital: [hospital()],
      }),
    })
    const p = await svc.getTimeline('c-1')
    expect(p.total).toBeGreaterThanOrEqual(5)
    for (let i = 1; i < p.entries.length; i++) {
      expect(p.entries[i]!.at >= p.entries[i - 1]!.at).toBe(true)
    }
  })

  it('paginates with cursor', async () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      injury({ id: `i-${i}`, createdAt: new Date(2026, 0, i + 1) }))
    const svc = new MedicalTimelineService({ repos: makeRepos({ injuries: many }) })
    const first = await svc.getTimeline('c-1', { limit: 10 })
    expect(first.entries).toHaveLength(10)
    expect(first.nextCursor).not.toBeNull()
    const second = await svc.getTimeline('c-1', { limit: 10, cursor: first.nextCursor })
    expect(second.entries.length).toBeGreaterThan(0)
    expect(second.entries[0]!.at).not.toEqual(first.entries[0]!.at)
  })

  it('since/until filters entries', async () => {
    const svc = new MedicalTimelineService({
      repos: makeRepos({
        injuries: [
          injury({ id: 'i-old', createdAt: new Date('2025-01-01') }),
          injury({ id: 'i-new', createdAt: new Date('2026-06-01') }),
        ],
      }),
    })
    const p = await svc.getTimeline('c-1', { since: new Date('2026-01-01') })
    expect(p.entries.every((e) => e.at >= new Date('2026-01-01'))).toBe(true)
    expect(p.entries.find((e) => e.injuryId === 'i-old')).toBeUndefined()
  })

  it('treatment.revive produces a patient_revived entry', async () => {
    const svc = new MedicalTimelineService({
      repos: makeRepos({ treatments: [treatment({ type: 'revive' })] }),
    })
    const p = await svc.getTimeline('c-1')
    expect(p.entries.some((e) => e.kind === 'patient_revived')).toBe(true)
  })

  it('trauma → deceased produces a patient_deceased entry', async () => {
    const svc = new MedicalTimelineService({
      repos: makeRepos({ trauma: [trauma({ state: 'deceased' })] }),
    })
    const p = await svc.getTimeline('c-1')
    expect(p.entries.some((e) => e.kind === 'patient_deceased')).toBe(true)
  })

  it('repository errors fail soft (null-safe joins)', async () => {
    const repos: MedicalReadRepositories = {
      injuries:   { listByCharacter: async () => { throw new Error('boom') } },
      trauma:     { listByCharacter: async () => [] },
      treatments: { listByCharacter: async () => [] },
      reports:    { listByCharacter: async () => [] },
      hospital:   { listByCharacter: async () => [] },
    }
    const svc = new MedicalTimelineService({ repos })
    const p = await svc.getTimeline('c-1')
    expect(p.entries).toEqual([])
  })
})

// ── Analytics ────────────────────────────────────────────────────────────────

describe('TraumaAnalyticsService', () => {
  it('clinical history aggregates counts', async () => {
    const svc = new TraumaAnalyticsService({
      repos: makeRepos({
        injuries: [injury(), injury({ id: 'i-2', severity: 'critical', region: 'chest' })],
        trauma: [trauma({ state: 'bleeding', stateChangedAt: new Date('2026-02-01') })],
        treatments: [treatment(), treatment({ id: 'tr-2', type: 'cpr' })],
      }),
    })
    const h = await svc.getClinicalHistory('c-1')
    expect(h.totalInjuries).toBe(2)
    expect(h.injuriesBySeverity.minor).toBe(1)
    expect(h.injuriesBySeverity.critical).toBe(1)
    expect(h.currentTrauma).toBe('bleeding')
  })

  it('trauma analytics finds repeated regions and revives', async () => {
    const recent = new Date()
    const svc = new TraumaAnalyticsService({
      repos: makeRepos({
        injuries: [
          injury({ id: 'i-1', region: 'head', createdAt: recent }),
          injury({ id: 'i-2', region: 'head', createdAt: recent }),
          injury({ id: 'i-3', region: 'spine', createdAt: recent, severity: 'critical' }),
        ],
        treatments: [treatment({ type: 'revive', appliedAt: recent })],
        hospital: [hospital({ admittedAt: recent })],
      }),
    })
    const r = await svc.getTraumaAnalytics('c-1', 30)
    expect(r.repeatedInjuryRegions[0]!.region).toBe('head')
    expect(r.revivesInWindow).toBe(1)
    expect(r.criticalEventsInWindow).toBe(1)
    expect(r.hospitalizationsInWindow).toBe(1)
  })

  it('responder history empty for unknown responder', async () => {
    const svc = new TraumaAnalyticsService({ repos: makeRepos() })
    const r = await svc.getResponderHistory('unknown')
    expect(r.totalTreatments).toBe(0)
  })

  it('window is clamped at 365 days', async () => {
    const svc = new TraumaAnalyticsService({ repos: makeRepos() })
    const r = await svc.getTraumaAnalytics('c-1', 99999)
    expect(r.windowDays).toBeLessThanOrEqual(365)
  })

  it('static severityWeight matches table', () => {
    expect(TraumaAnalyticsService.severityWeight('minor')).toBe(MEDICAL_SEVERITY_WEIGHTS.minor)
    expect(TraumaAnalyticsService.severityWeight('fatal')).toBe(MEDICAL_SEVERITY_WEIGHTS.fatal)
  })
})

// ── Correlation ──────────────────────────────────────────────────────────────

describe('InvestigationCorrelationService', () => {
  it('aggregates incident medical data', async () => {
    const svc = new InvestigationCorrelationService({
      repos: makeRepos({
        injuries: [injury({ incidentId: 'inc-1' }), injury({ id: 'i-2', characterId: 'c-2', incidentId: 'inc-1', severity: 'critical' })],
        treatments: [treatment({ incidentId: 'inc-1', appliedByPrincipalId: 'p-1' })],
        reports: [report({ incidentId: 'inc-1' })],
      }),
    })
    const r = await svc.getIncidentCorrelation('inc-1')
    expect(r.injuriesAtScene).toHaveLength(2)
    expect(r.uniquePatients.sort()).toEqual(['c-1', 'c-2'])
    expect(r.responders).toEqual(['p-1'])
    expect(r.severityBreakdown.minor).toBe(1)
    expect(r.severityBreakdown.critical).toBe(1)
  })

  it('empty incident id returns empty correlation', async () => {
    const svc = new InvestigationCorrelationService({ repos: makeRepos() })
    const r = await svc.getIncidentCorrelation('')
    expect(r.uniquePatients).toEqual([])
  })
})

// ── Risk ─────────────────────────────────────────────────────────────────────

describe('MedicalRiskService', () => {
  it('empty character id returns zero score', async () => {
    const svc = new MedicalRiskService({ repos: makeRepos() })
    const r = await svc.computeRisk('')
    expect(r.score).toBe(0)
  })

  it('risk score bounded to [0,1]', async () => {
    const recent = new Date()
    const svc = new MedicalRiskService({
      repos: makeRepos({
        injuries: Array.from({ length: 20 }, (_, i) => injury({ id: `i-${i}`, severity: 'critical', createdAt: recent })),
        hospital: Array.from({ length: 5 }, (_, i) => hospital({ id: `h-${i}`, admittedAt: recent })),
      }),
    })
    const r = await svc.computeRisk('c-1')
    expect(r.score).toBeGreaterThan(0)
    expect(r.score).toBeLessThanOrEqual(1)
    expect(r.notes.length).toBeGreaterThan(0)
  })

  it('detects self-harm pattern (repeated minor + no incident)', async () => {
    const recent = new Date()
    const svc = new MedicalRiskService({
      repos: makeRepos({
        injuries: Array.from({ length: 5 }, (_, i) =>
          injury({ id: `i-${i}`, incidentId: null, severity: 'minor', createdAt: recent })),
      }),
    })
    const r = await svc.computeRisk('c-1', 30)
    expect(r.notes).toContain('repeated-self-treated-minor-injuries')
  })
})

// ── SDK ──────────────────────────────────────────────────────────────────────

describe('AtcMedicalIntelligenceSDK', () => {
  it('exposes the documented read methods', () => {
    const sdk = new AtcMedicalIntelligenceSDK({ repos: makeRepos() })
    expect(typeof sdk.getHistory).toBe('function')
    expect(typeof sdk.getTimeline).toBe('function')
    expect(typeof sdk.getRisk).toBe('function')
    expect(typeof sdk.getAnalytics).toBe('function')
    expect(typeof sdk.getResponderHistory).toBe('function')
    expect(typeof sdk.getIncidentCorrelation).toBe('function')
  })

  it('does not expose write methods', () => {
    const sdk = new AtcMedicalIntelligenceSDK({ repos: makeRepos() })
    expect((sdk as unknown as Record<string, unknown>).createInjury).toBeUndefined()
    expect((sdk as unknown as Record<string, unknown>).deletePatient).toBeUndefined()
  })
})

// ── Schemas ──────────────────────────────────────────────────────────────────

describe('medical-intel schemas', () => {
  it('timeline limit capped at 100', () => {
    expect(medicalIntelTimelineQuerySchema.safeParse({ limit: 200 }).success).toBe(false)
  })
  it('window default 90', () => {
    const r = medicalIntelWindowQuerySchema.safeParse({})
    if (r.success) expect(r.data.windowDays).toBe(90)
  })
  it('window capped at 365', () => {
    expect(medicalIntelWindowQuerySchema.safeParse({ windowDays: 999 }).success).toBe(false)
  })
  it('character param requires id', () => {
    expect(medicalIntelCharacterParamSchema.safeParse({}).success).toBe(false)
    expect(medicalIntelCharacterParamSchema.safeParse({ id: 'c-1' }).success).toBe(true)
  })
  it('incident param requires id', () => {
    expect(medicalIntelIncidentParamSchema.safeParse({ id: 'inc-1' }).success).toBe(true)
  })
})

describe('MEDICAL_INTEL_LIMITS', () => {
  it('hard caps coherent', () => {
    expect(MEDICAL_INTEL_LIMITS.MAX_LIMIT).toBeLessThanOrEqual(100)
    expect(MEDICAL_INTEL_LIMITS.MAX_ANALYTICS_WINDOW_DAYS).toBeLessThanOrEqual(365)
  })
})
