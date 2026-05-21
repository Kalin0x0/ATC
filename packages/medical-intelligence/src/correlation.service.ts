import type { AtcMedicalSeverity } from '@atc/shared-types'
import type {
  MedicalReadRepositories,
  IncidentMedicalCorrelation,
} from './types.js'
import { MEDICAL_INTEL_LIMITS } from './limits.js'

export interface InvestigationCorrelationServiceOptions {
  repos: MedicalReadRepositories
}

function emptySeverityMap(): Record<AtcMedicalSeverity, number> {
  return { minor: 0, moderate: 0, critical: 0, fatal: 0 }
}

/**
 * InvestigationCorrelationService — correlates medical evidence with
 * incidents for case reconstruction. Strictly read-only.
 */
export class InvestigationCorrelationService {
  private readonly repos: MedicalReadRepositories

  constructor(opts: InvestigationCorrelationServiceOptions) {
    this.repos = opts.repos
  }

  async getIncidentCorrelation(incidentId: string): Promise<IncidentMedicalCorrelation> {
    const empty: IncidentMedicalCorrelation = {
      incidentId: incidentId ?? '',
      injuriesAtScene: [],
      treatmentsApplied: [],
      reports: [],
      uniquePatients: [],
      responders: [],
      severityBreakdown: emptySeverityMap(),
    }
    if (!incidentId) return empty

    const batch = MEDICAL_INTEL_LIMITS.MAX_BATCH
    const [injuries, treatments, reports] = await Promise.all([
      this.repos.injuries.listByIncident?.(incidentId, batch).catch(() => []) ?? Promise.resolve([]),
      this.repos.treatments.listByIncident?.(incidentId, batch).catch(() => []) ?? Promise.resolve([]),
      this.repos.reports.listByIncident?.(incidentId, batch).catch(() => []) ?? Promise.resolve([]),
    ])

    const patients = new Set<string>()
    const responders = new Set<string>()
    const severityBreakdown = emptySeverityMap()

    for (const i of injuries) {
      patients.add(i.characterId)
      severityBreakdown[i.severity]++
    }
    for (const t of treatments) {
      patients.add(t.characterId)
      responders.add(t.appliedByPrincipalId)
    }
    for (const r of reports) {
      patients.add(r.characterId)
    }

    return {
      incidentId,
      injuriesAtScene: injuries,
      treatmentsApplied: treatments,
      reports,
      uniquePatients: Array.from(patients),
      responders: Array.from(responders),
      severityBreakdown,
    }
  }
}
