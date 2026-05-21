import type {
  AtcBodyRegion,
  AtcMedicalSeverity,
  AtcTreatmentType,
} from '@atc/shared-types'
import type {
  MedicalReadRepositories,
  ClinicalHistorySummary,
  TraumaAnalyticsResult,
  ResponderHistorySummary,
} from './types.js'
import { MEDICAL_INTEL_LIMITS, MEDICAL_SEVERITY_WEIGHTS } from './limits.js'

export interface TraumaAnalyticsServiceOptions {
  repos: MedicalReadRepositories
}

const SEVERITIES: AtcMedicalSeverity[] = ['minor', 'moderate', 'critical', 'fatal']

function emptySeverityMap(): Record<AtcMedicalSeverity, number> {
  return { minor: 0, moderate: 0, critical: 0, fatal: 0 }
}

function withinWindow<T extends { createdAt?: Date; appliedAt?: Date; stateChangedAt?: Date; admittedAt?: Date }>(
  item: T, since: Date,
): boolean {
  const at = item.createdAt ?? item.appliedAt ?? item.stateChangedAt ?? item.admittedAt
  return at !== undefined && at >= since
}

function clampWindow(days: number | undefined): number {
  const d = days ?? 90
  return Math.max(1, Math.min(d, MEDICAL_INTEL_LIMITS.MAX_ANALYTICS_WINDOW_DAYS))
}

export class TraumaAnalyticsService {
  private readonly repos: MedicalReadRepositories
  constructor(opts: TraumaAnalyticsServiceOptions) {
    this.repos = opts.repos
  }

  // ── Clinical history summary ──────────────────────────────────────────

  async getClinicalHistory(characterId: string): Promise<ClinicalHistorySummary> {
    const empty: ClinicalHistorySummary = {
      characterId,
      totalInjuries: 0, totalTreatments: 0, totalHospitalizations: 0, totalReports: 0,
      currentTrauma: null,
      injuriesBySeverity: emptySeverityMap(),
      injuriesByRegion: {},
      treatmentsByType: {},
    }
    if (!characterId) return { ...empty, characterId: '' }

    const batch = MEDICAL_INTEL_LIMITS.MAX_BATCH
    const [injuries, trauma, treatments, reports, hospital] = await Promise.all([
      this.repos.injuries.listByCharacter(characterId, batch).catch(() => []),
      this.repos.trauma.listByCharacter(characterId, batch).catch(() => []),
      this.repos.treatments.listByCharacter(characterId, batch).catch(() => []),
      this.repos.reports.listByCharacter(characterId, batch).catch(() => []),
      this.repos.hospital.listByCharacter(characterId, batch).catch(() => []),
    ])

    const injuriesBySeverity = emptySeverityMap()
    const injuriesByRegion: Partial<Record<AtcBodyRegion, number>> = {}
    for (const i of injuries) {
      injuriesBySeverity[i.severity]++
      injuriesByRegion[i.region] = (injuriesByRegion[i.region] ?? 0) + 1
    }

    const treatmentsByType: Partial<Record<AtcTreatmentType, number>> = {}
    for (const t of treatments) {
      treatmentsByType[t.type] = (treatmentsByType[t.type] ?? 0) + 1
    }

    // Most recent trauma transition is the current state.
    const sortedTrauma = [...trauma].sort((a, b) => b.stateChangedAt.getTime() - a.stateChangedAt.getTime())
    const currentTrauma = sortedTrauma[0]?.state ?? null

    return {
      characterId,
      totalInjuries: injuries.length,
      totalTreatments: treatments.length,
      totalHospitalizations: hospital.length,
      totalReports: reports.length,
      currentTrauma,
      injuriesBySeverity,
      injuriesByRegion,
      treatmentsByType,
    }
  }

  // ── Trauma analytics (rolling window) ─────────────────────────────────

  async getTraumaAnalytics(characterId: string, windowDays?: number): Promise<TraumaAnalyticsResult> {
    const days = clampWindow(windowDays)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    if (!characterId) {
      return {
        characterId: '',
        windowDays: days,
        repeatedInjuryRegions: [],
        traumaFrequencyPerWeek: 0,
        hospitalizationsInWindow: 0,
        revivesInWindow: 0,
        criticalEventsInWindow: 0,
        responderWorkload: [],
      }
    }

    const batch = MEDICAL_INTEL_LIMITS.MAX_BATCH
    const [injuries, trauma, treatments, hospital] = await Promise.all([
      this.repos.injuries.listByCharacter(characterId, batch).catch(() => []),
      this.repos.trauma.listByCharacter(characterId, batch).catch(() => []),
      this.repos.treatments.listByCharacter(characterId, batch).catch(() => []),
      this.repos.hospital.listByCharacter(characterId, batch).catch(() => []),
    ])

    const recentInjuries = injuries.filter((i) => withinWindow(i, since))
    const recentTrauma = trauma.filter((t) => withinWindow(t, since))
    const recentTreatments = treatments.filter((t) => withinWindow(t, since))
    const recentHospital = hospital.filter((h) => withinWindow(h, since))

    const regionCounts = new Map<AtcBodyRegion, number>()
    for (const i of recentInjuries) {
      regionCounts.set(i.region, (regionCounts.get(i.region) ?? 0) + 1)
    }
    const repeatedInjuryRegions = Array.from(regionCounts.entries())
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([region, count]) => ({ region, count }))

    const weeks = Math.max(1, days / 7)
    const traumaFrequencyPerWeek = recentTrauma.length / weeks

    const responderCounts = new Map<string, number>()
    for (const t of recentTreatments) {
      responderCounts.set(t.appliedByPrincipalId,
        (responderCounts.get(t.appliedByPrincipalId) ?? 0) + 1)
    }
    const responderWorkload = Array.from(responderCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([principalId, treatments]) => ({ principalId, treatments }))

    const revives = recentTreatments.filter((t) => t.type === 'revive').length
    const criticalCount = recentInjuries.filter((i) => i.severity === 'critical' || i.severity === 'fatal').length

    return {
      characterId,
      windowDays: days,
      repeatedInjuryRegions,
      traumaFrequencyPerWeek,
      hospitalizationsInWindow: recentHospital.length,
      revivesInWindow: revives,
      criticalEventsInWindow: criticalCount,
      responderWorkload,
    }
  }

  // ── Responder history ──────────────────────────────────────────────────

  async getResponderHistory(principalId: string, windowDays?: number): Promise<ResponderHistorySummary> {
    const days = clampWindow(windowDays)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    if (!principalId || !this.repos.treatments.listByResponder) {
      return {
        principalId,
        totalTreatments: 0,
        patientsTreated: 0,
        treatmentsByType: {},
        averageTreatmentsPerWeek: 0,
        recentPatients: [],
      }
    }
    const treatments = await this.repos.treatments.listByResponder(principalId, MEDICAL_INTEL_LIMITS.MAX_BATCH)
      .catch(() => [])
    const recent = treatments.filter((t) => withinWindow(t, since))
    const byType: Partial<Record<AtcTreatmentType, number>> = {}
    const patients = new Set<string>()
    for (const t of recent) {
      byType[t.type] = (byType[t.type] ?? 0) + 1
      patients.add(t.characterId)
    }
    return {
      principalId,
      totalTreatments: recent.length,
      patientsTreated: patients.size,
      treatmentsByType: byType,
      averageTreatmentsPerWeek: recent.length / Math.max(1, days / 7),
      recentPatients: Array.from(patients).slice(0, 50),
    }
  }

  // Severity → numeric weight, used by the risk service.
  static severityWeight(s: AtcMedicalSeverity): number {
    return MEDICAL_SEVERITY_WEIGHTS[s] ?? 0
  }
}

export type { AtcMedicalSeverity }
export const SEVERITY_ORDER = SEVERITIES
