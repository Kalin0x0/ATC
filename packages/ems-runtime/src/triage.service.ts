import type { AtcTriageCategory, AtcMedicalSeverity, AtcEmsEmergency } from '@atc/shared-types'
import { TriageValidationError } from './errors.js'

// Numeric priority scores — higher = more urgent
const SEVERITY_SCORES: Record<AtcMedicalSeverity, number> = {
  minor:    10,
  moderate: 40,
  critical: 80,
  fatal:    100,
}

const CATEGORY_PRIORITY: Record<AtcTriageCategory, number> = {
  black:  0,   // expectant / deceased — lowest routing priority
  green:  10,
  yellow: 50,
  red:    100,
}

export interface TriageInput {
  severity: AtcMedicalSeverity
  isCardiacArrest?: boolean | undefined
  isUnconscious?: boolean | undefined
  isBleeding?: boolean | undefined
}

export class TriageService {
  // Compute a numeric priority score for a single patient
  score(input: TriageInput): number {
    let s = SEVERITY_SCORES[input.severity]
    if (input.isCardiacArrest) s = Math.max(s, 95)
    if (input.isUnconscious)   s = Math.max(s, 70)
    if (input.isBleeding)      s = Math.max(s, 50)
    return s
  }

  // Assign a triage category based on severity and optional vital indicators
  assign(input: TriageInput): AtcTriageCategory {
    if (input.severity === 'fatal') return 'black'
    if (input.isCardiacArrest || input.severity === 'critical') return 'red'
    if (input.isUnconscious || input.isBleeding || input.severity === 'moderate') return 'yellow'
    return 'green'
  }

  // Sort emergencies by triage priority (red → yellow → green → black)
  sortByPriority(emergencies: AtcEmsEmergency[]): AtcEmsEmergency[] {
    return [...emergencies].sort((a, b) => {
      const pa = a.triageCategory ? CATEGORY_PRIORITY[a.triageCategory] : -1
      const pb = b.triageCategory ? CATEGORY_PRIORITY[b.triageCategory] : -1
      return pb - pa
    })
  }

  // Validate triage category is a recognised value
  validate(category: string): AtcTriageCategory {
    const valid: AtcTriageCategory[] = ['red', 'yellow', 'green', 'black']
    if (!valid.includes(category as AtcTriageCategory)) {
      throw new TriageValidationError(`unknown triage category: ${category}`)
    }
    return category as AtcTriageCategory
  }
}
