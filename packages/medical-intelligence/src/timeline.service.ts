import type {
  AtcMedicalSeverity,
  AtcTraumaState,
  AtcBodyRegion,
  AtcTreatmentType,
} from '@atc/shared-types'
import type {
  MedicalReadRepositories,
  MedicalTimelineEntry,
  MedicalTimelinePage,
} from './types.js'
import { MEDICAL_INTEL_LIMITS } from './limits.js'
import { decodeCursor, nextCursor } from './cursor.js'

export interface MedicalTimelineServiceOptions {
  repos: MedicalReadRepositories
}

function clamp(limit: number | undefined): number {
  const cap = MEDICAL_INTEL_LIMITS.MAX_LIMIT
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) return MEDICAL_INTEL_LIMITS.DEFAULT_LIMIT
  return Math.min(Math.floor(limit), cap)
}

/**
 * MedicalTimelineService — append-only longitudinal patient history.
 *
 * Aggregates injuries, trauma transitions, treatments, hospitalizations,
 * and medical reports into a single chronological view. Bounded by
 * MAX_BATCH per source repository.
 */
export class MedicalTimelineService {
  private readonly repos: MedicalReadRepositories

  constructor(opts: MedicalTimelineServiceOptions) {
    this.repos = opts.repos
  }

  async getTimeline(
    characterId: string,
    options: {
      limit?: number
      cursor?: string | null
      since?: Date | null
      until?: Date | null
    } = {},
  ): Promise<MedicalTimelinePage> {
    const cap = clamp(options.limit)
    const cursor = options.cursor ?? null
    const offset = decodeCursor(cursor)

    if (!characterId) {
      return { characterId: '', entries: [], total: 0, limit: cap, cursor, nextCursor: null }
    }

    const batch = MEDICAL_INTEL_LIMITS.MAX_BATCH

    const [injuries, trauma, treatments, reports, hospital] = await Promise.all([
      this.repos.injuries.listByCharacter(characterId, batch).catch(() => []),
      this.repos.trauma.listByCharacter(characterId, batch).catch(() => []),
      this.repos.treatments.listByCharacter(characterId, batch).catch(() => []),
      this.repos.reports.listByCharacter(characterId, batch).catch(() => []),
      this.repos.hospital.listByCharacter(characterId, batch).catch(() => []),
    ])

    const entries: MedicalTimelineEntry[] = []
    for (const i of injuries) {
      entries.push({
        at: i.createdAt, kind: 'injury_recorded', characterId,
        detail: `${i.severity} injury to ${i.region}: ${i.description}`,
        incidentId: i.incidentId, injuryId: i.id, treatmentId: null, reportId: null,
        hospitalId: null,
        severity: i.severity, state: null, region: i.region, treatmentType: null,
      })
    }
    for (const t of trauma) {
      entries.push({
        at: t.stateChangedAt, kind: 'trauma_changed', characterId,
        detail: `trauma → ${t.state}${t.previousState ? ` (from ${t.previousState})` : ''}`,
        incidentId: null, injuryId: null, treatmentId: null, reportId: null,
        hospitalId: null,
        severity: null, state: t.state, region: null, treatmentType: null,
      })
      if (t.state === 'deceased') {
        entries.push({
          at: t.stateChangedAt, kind: 'patient_deceased', characterId,
          detail: 'patient deceased',
          incidentId: null, injuryId: null, treatmentId: null, reportId: null,
          hospitalId: null,
          severity: null, state: 'deceased', region: null, treatmentType: null,
        })
      }
    }
    for (const tr of treatments) {
      entries.push({
        at: tr.appliedAt, kind: 'treatment_applied', characterId,
        detail: `${tr.type}${tr.notes ? `: ${tr.notes}` : ''}`,
        incidentId: tr.incidentId, injuryId: null, treatmentId: tr.id, reportId: null,
        hospitalId: null,
        severity: null,
        state: tr.resultingTrauma,
        region: null, treatmentType: tr.type,
      })
      if (tr.type === 'revive') {
        entries.push({
          at: tr.appliedAt, kind: 'patient_revived', characterId,
          detail: 'patient revived',
          incidentId: tr.incidentId, injuryId: null, treatmentId: tr.id,
          reportId: null, hospitalId: null,
          severity: null, state: tr.resultingTrauma, region: null, treatmentType: 'revive',
        })
      }
    }
    for (const r of reports) {
      entries.push({
        at: r.createdAt, kind: 'medical_report_created', characterId,
        detail: r.diagnosis,
        incidentId: r.incidentId, injuryId: null, treatmentId: null, reportId: r.id,
        hospitalId: null,
        severity: null, state: null, region: null, treatmentType: null,
      })
    }
    for (const h of hospital) {
      entries.push({
        at: h.admittedAt, kind: 'hospital_admitted', characterId,
        detail: `admitted (${h.status})`,
        incidentId: h.incidentId, injuryId: null, treatmentId: null, reportId: null,
        hospitalId: h.id,
        severity: null, state: null, region: null, treatmentType: null,
      })
      if (h.dischargedAt) {
        entries.push({
          at: h.dischargedAt, kind: 'hospital_discharged', characterId,
          detail: 'discharged',
          incidentId: h.incidentId, injuryId: null, treatmentId: null, reportId: null,
          hospitalId: h.id,
          severity: null, state: null, region: null, treatmentType: null,
        })
      } else if (h.statusChangedAt > h.admittedAt) {
        entries.push({
          at: h.statusChangedAt, kind: 'hospital_status_changed', characterId,
          detail: `status → ${h.status}`,
          incidentId: h.incidentId, injuryId: null, treatmentId: null, reportId: null,
          hospitalId: h.id,
          severity: null, state: null, region: null, treatmentType: null,
        })
      }
    }

    const filtered = entries
      .filter((e) => (!options.since || e.at >= options.since) && (!options.until || e.at <= options.until))
      .sort((a, b) => a.at.getTime() - b.at.getTime())

    const total = filtered.length
    const page = filtered.slice(offset, offset + cap)
    return {
      characterId,
      entries: page,
      total,
      limit: cap,
      cursor,
      nextCursor: nextCursor(offset, page.length, total),
    }
  }
}

// Re-export commonly-used primitives to keep this surface ergonomic
export type { AtcMedicalSeverity, AtcTraumaState, AtcBodyRegion, AtcTreatmentType }
