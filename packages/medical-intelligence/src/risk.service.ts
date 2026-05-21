import type { MedicalReadRepositories, MedicalRiskScore } from './types.js'
import { MEDICAL_INTEL_LIMITS, MEDICAL_SEVERITY_WEIGHTS } from './limits.js'

export interface MedicalRiskServiceOptions {
  repos: MedicalReadRepositories
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

/**
 * MedicalRiskService — soft analytics only. Computes risk indicators based
 * on injury patterns, hospitalizations, repeat trauma. Confidence is
 * bounded in [0, 1]; consumers must not derive automatic punishments from
 * these scores.
 */
export class MedicalRiskService {
  private readonly repos: MedicalReadRepositories
  constructor(opts: MedicalRiskServiceOptions) {
    this.repos = opts.repos
  }

  async computeRisk(characterId: string, windowDays = 90): Promise<MedicalRiskScore> {
    const empty: MedicalRiskScore = {
      characterId, score: 0,
      factors: {
        chronicTrauma: 0, selfHarmIndicators: 0, repeatViolence: 0,
        highRiskResponderExposure: 0, incidentClustering: 0,
        emergencyEscalationFrequency: 0,
      },
      notes: [],
    }
    if (!characterId) return { ...empty, characterId: '' }

    const days = Math.max(1, Math.min(windowDays, MEDICAL_INTEL_LIMITS.MAX_ANALYTICS_WINDOW_DAYS))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const batch = MEDICAL_INTEL_LIMITS.MAX_BATCH
    const [injuries, trauma, treatments, hospital] = await Promise.all([
      this.repos.injuries.listByCharacter(characterId, batch).catch(() => []),
      this.repos.trauma.listByCharacter(characterId, batch).catch(() => []),
      this.repos.treatments.listByCharacter(characterId, batch).catch(() => []),
      this.repos.hospital.listByCharacter(characterId, batch).catch(() => []),
    ])

    const recentInjuries = injuries.filter((i) => i.createdAt >= since)
    const recentTrauma = trauma.filter((t) => t.stateChangedAt >= since)
    const recentTreatments = treatments.filter((t) => t.appliedAt >= since)
    const recentHospital = hospital.filter((h) => h.admittedAt >= since)
    const notes: string[] = []

    // Chronic trauma — repeated trauma transitions over the window.
    const chronicTrauma = clamp01(recentTrauma.length / 12)
    if (recentTrauma.length >= 6) notes.push('chronic-trauma-pattern')

    // Self-harm indicators — repeated minor injuries with no incident link.
    const selfHarmCount = recentInjuries.filter(
      (i) => i.incidentId === null && i.severity === 'minor',
    ).length
    const selfHarmIndicators = clamp01(selfHarmCount / 8)
    if (selfHarmCount >= 4) notes.push('repeated-self-treated-minor-injuries')

    // Repeat violence — felony-equivalent severity bucketing.
    const violenceWeight = recentInjuries.reduce(
      (sum, i) => sum + (MEDICAL_SEVERITY_WEIGHTS[i.severity] ?? 0), 0,
    )
    const repeatViolence = clamp01(violenceWeight / 40)
    if (violenceWeight >= 30) notes.push('high-cumulative-injury-severity')

    // High-risk responder exposure — repeated treatments by the same responder.
    const responderCounts = new Map<string, number>()
    for (const t of recentTreatments) {
      responderCounts.set(t.appliedByPrincipalId,
        (responderCounts.get(t.appliedByPrincipalId) ?? 0) + 1)
    }
    const maxResponder = Math.max(0, ...Array.from(responderCounts.values()))
    const highRiskResponderExposure = clamp01(maxResponder / 10)

    // Incident clustering — multiple distinct incidents over window.
    const distinctIncidents = new Set<string>()
    for (const i of recentInjuries) if (i.incidentId) distinctIncidents.add(i.incidentId)
    const incidentClustering = clamp01(distinctIncidents.size / 6)

    // Emergency escalation frequency — hospitalizations + critical events.
    const criticalCount = recentInjuries.filter(
      (i) => i.severity === 'critical' || i.severity === 'fatal',
    ).length
    const emergencyEscalationFrequency = clamp01((criticalCount + recentHospital.length) / 8)

    const factors = {
      chronicTrauma,
      selfHarmIndicators,
      repeatViolence,
      highRiskResponderExposure,
      incidentClustering,
      emergencyEscalationFrequency,
    }

    const score = clamp01(
      factors.chronicTrauma                * 0.20 +
      factors.selfHarmIndicators           * 0.15 +
      factors.repeatViolence               * 0.20 +
      factors.highRiskResponderExposure    * 0.10 +
      factors.incidentClustering           * 0.15 +
      factors.emergencyEscalationFrequency * 0.20,
    )

    return { characterId, score, factors, notes }
  }
}
